// ==============================================================================
// DEMINVEST — CENTRALIZED BACKEND ENGINE (PROVIDERS, SCHEDULER, PUSH, AI)
// ==============================================================================
// Questo modulo viene eseguito ESCLUSIVAMENTE lato server (Node.js / Edge).
// Nessuna chiave API privata viene mai esposta al client browser.
// ==============================================================================

import {
  AIChatMessage,
  AIToolCallLog,
  AlertRule,
  BrokerInstrumentMapping,
  CandleTimeframe,
  DataExecutionMode,
  GeneratedSignal,
  HistoricalCandle,
  MarketQuote,
  NegotiableInstrument,
  NotificationItem,
  PaperAccountState,
  PortfolioTransaction,
  ProviderHealthInfo,
  SchedulerStatusInfo,
  TimeHorizon,
  UnderlyingAsset,
  UserProfileAndPreferences,
} from '../src/types/domain';
import {
  getMarketVenueStatus,
  INITIAL_BROKER_MAPPINGS,
  INITIAL_NEGOTIABLE_INSTRUMENTS,
  INITIAL_UNDERLYING_ASSETS,
} from '../src/engines/instrumentRegistry';
import { computeQuantitativeSnapshot } from '../src/engines/quantitativeEngine';
import {
  evaluateDeterministicSignal,
  evaluateSignalLifecycleTransition,
  evaluateUserAlertRules,
  isDuplicateSignal,
} from '../src/engines/signalIntelligenceEngine';
import { calculatePortfolioAnalytics, FxRateTable } from '../src/engines/portfolioEngine';
import { getExplicitDemoCandles, getExplicitDemoQuote } from './demoReferenceData';

export interface PushSubscriptionItem {
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
}

export interface NodePlatformBridge {
  readJsonFile<T>(filename: string): T | null;
  writeJsonFile(filename: string, data: unknown): void;
  generateVapidKeys(): { publicKey: string; privateKey: string };
  sendWebPush(
    vapid: { subject: string; publicKey: string; privateKey: string },
    subscription: PushSubscriptionItem,
    payload: string
  ): Promise<void>;
}

let activeNodeBridge: NodePlatformBridge | null = null;

export function registerNodePlatformBridge(bridge: NodePlatformBridge): void {
  activeNodeBridge = bridge;
}

const DB_FILENAME = 'deminvest-db.json';
const VAPID_FILENAME = 'vapid-keys.json';
const SECRETS_FILENAME = 'runtime-secrets.json';

let cloudEnvOverrides: Record<string, string | undefined> = {};
let memoryRuntimeSecrets: RuntimeSecrets = {};
let memoryVapidKeys: VapidKeys | null = null;

export function configureCloudEnvironment(env?: Record<string, string | undefined>) {
  if (env) {
    cloudEnvOverrides = { ...cloudEnvOverrides, ...env };
  }
}

function getEnvVar(key: string): string {
  if (cloudEnvOverrides[key]) return String(cloudEnvOverrides[key]);
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return String(process.env[key]);
  }
  return '';
}

interface RuntimeSecrets {
  COINGECKO_API_KEY?: string;
  TWELVE_DATA_API_KEY?: string;
  ALPHA_VANTAGE_API_KEY?: string;
  FRED_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

function loadRuntimeSecrets(): RuntimeSecrets {
  const fileSecrets: RuntimeSecrets =
    activeNodeBridge?.readJsonFile<RuntimeSecrets>(SECRETS_FILENAME) || {};
  return {
    COINGECKO_API_KEY:
      getEnvVar('COINGECKO_API_KEY') ||
      memoryRuntimeSecrets.COINGECKO_API_KEY ||
      fileSecrets.COINGECKO_API_KEY ||
      '',
    TWELVE_DATA_API_KEY:
      getEnvVar('TWELVE_DATA_API_KEY') ||
      memoryRuntimeSecrets.TWELVE_DATA_API_KEY ||
      fileSecrets.TWELVE_DATA_API_KEY ||
      '',
    ALPHA_VANTAGE_API_KEY:
      getEnvVar('ALPHA_VANTAGE_API_KEY') ||
      memoryRuntimeSecrets.ALPHA_VANTAGE_API_KEY ||
      fileSecrets.ALPHA_VANTAGE_API_KEY ||
      '',
    FRED_API_KEY:
      getEnvVar('FRED_API_KEY') ||
      memoryRuntimeSecrets.FRED_API_KEY ||
      fileSecrets.FRED_API_KEY ||
      '',
    GEMINI_API_KEY:
      getEnvVar('GEMINI_API_KEY') ||
      memoryRuntimeSecrets.GEMINI_API_KEY ||
      fileSecrets.GEMINI_API_KEY ||
      '',
  };
}

export function saveRuntimeSecret(key: keyof RuntimeSecrets, value: string): void {
  const clean = value.trim();
  memoryRuntimeSecrets[key] = clean;
  if (activeNodeBridge) {
    const existing = activeNodeBridge.readJsonFile<RuntimeSecrets>(SECRETS_FILENAME) || {};
    existing[key] = clean;
    activeNodeBridge.writeJsonFile(SECRETS_FILENAME, existing);
  }
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function getOrInitVapidKeys(): VapidKeys {
  const envPub = getEnvVar('VAPID_PUBLIC_KEY') || getEnvVar('VITE_VAPID_PUBLIC_KEY');
  const envPriv = getEnvVar('VAPID_PRIVATE_KEY');
  if (envPub && envPriv) {
    return {
      publicKey: envPub,
      privateKey: envPriv,
      subject: getEnvVar('VAPID_SUBJECT') || 'mailto:owner@deminvest.local',
    };
  }
  if (memoryVapidKeys) return memoryVapidKeys;

  if (activeNodeBridge) {
    const parsed = activeNodeBridge.readJsonFile<VapidKeys>(VAPID_FILENAME);
    if (parsed && parsed.publicKey && parsed.privateKey) {
      memoryVapidKeys = parsed;
      return parsed;
    }
  }

  let keys: VapidKeys;
  if (activeNodeBridge) {
    const generated = activeNodeBridge.generateVapidKeys();
    keys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject: 'mailto:owner@deminvest.local',
    };
    activeNodeBridge.writeJsonFile(VAPID_FILENAME, keys);
  } else {
    keys = {
      publicKey:
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      privateKey: 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls',
      subject: 'mailto:owner@deminvest.local',
    };
  }
  memoryVapidKeys = keys;
  return keys;
}

export interface PersistedDatabaseState {
  singleUserMode: boolean;
  ownerAccount: {
    user: UserProfileAndPreferences;
    passwordHash: string;
  } | null;
  activeSessionToken: string | null;
  assets: UnderlyingAsset[];
  instruments: NegotiableInstrument[];
  brokerMappings: BrokerInstrumentMapping[];
  watchlistInstrumentIds: string[];
  alertRules: AlertRule[];
  generatedSignals: GeneratedSignal[];
  notifications: NotificationItem[];
  pushSubscriptions: PushSubscriptionItem[];
  portfolioTransactions: PortfolioTransaction[];
  paperAccount: PaperAccountState;
  journalEntries: {
    id: string;
    instrumentId?: string;
    title: string;
    hypothesis: string;
    outcomeReview: string;
    emotionalState: string;
    lessonsLearned: string;
    createdAt: string;
  }[];
  aiMessages: AIChatMessage[];
  aiToolLogs: AIToolCallLog[];
  schedulerStatus: SchedulerStatusInfo;
  providerStats: Record<
    string,
    {
      callsToday: number;
      lastSuccessAt: string | null;
      lastTestedAt: string | null;
      lastError: string | null;
    }
  >;
}

function getDefaultDbState(): PersistedDatabaseState {
  return {
    singleUserMode: process.env.SINGLE_USER_MODE !== 'false',
    ownerAccount: null,
    activeSessionToken: null,
    assets: [...INITIAL_UNDERLYING_ASSETS],
    instruments: [...INITIAL_NEGOTIABLE_INSTRUMENTS],
    brokerMappings: [...INITIAL_BROKER_MAPPINGS],
    watchlistInstrumentIds: [
      'INST_BTC_USD_SPOT',
      'INST_ETH_USD_SPOT',
      'INST_AAPL_XNGS_EQ',
      'INST_IBM_XNYS_EQ',
      'INST_EURUSD_FX',
    ],
    alertRules: [
      {
        id: 'ALERT_DEFAULT_BTC_VOL',
        instrumentId: 'INST_BTC_USD_SPOT',
        instrumentTicker: 'BTC/USD',
        brokerCode: 'TRADE_REPUBLIC',
        ruleType: 'PCT_CHANGE_24H',
        horizon: 'BREVE',
        thresholdValue: 3.5,
        priority: 'HIGH',
        cooldownMinutes: 120,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ALERT_DEFAULT_AAPL_RSI',
        instrumentId: 'INST_AAPL_XNGS_EQ',
        instrumentTicker: 'AAPL',
        brokerCode: 'IBKR',
        ruleType: 'RSI_OVERBOUGHT',
        horizon: 'BREVE',
        thresholdValue: 72,
        priority: 'MEDIUM',
        cooldownMinutes: 240,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ],
    generatedSignals: [],
    notifications: [],
    pushSubscriptions: [],
    portfolioTransactions: [
      {
        id: 'TX_INIT_DEPOSIT',
        transactionType: 'DEPOSIT',
        quantity: 1,
        unitPrice: 15000,
        fees: 0,
        currency: 'EUR',
        fxRateToBase: 1,
        fxSource: 'IDENTITY_SAME_CURRENCY',
        fxObservedAt: '2026-09-01T09:00:00Z',
        declaredBrokerCode: 'TRADE_REPUBLIC',
        executedAt: '2026-09-01T09:00:00Z',
        notes: 'Deposito iniziale conto investimenti personale',
      },
      {
        id: 'TX_INIT_BTC',
        instrumentId: 'INST_BTC_USD_SPOT',
        instrumentTicker: 'BTC/USD',
        transactionType: 'BUY',
        quantity: 0.05,
        unitPrice: 68500,
        fees: 1.0,
        currency: 'USD',
        fxRateToBase: 0.89,
        fxSource: 'ECB_FRANKFURTER',
        fxObservedAt: '2026-09-10T10:30:00Z',
        declaredBrokerCode: 'TRADE_REPUBLIC',
        executedAt: '2026-09-10T10:30:00Z',
        notes: 'Acquisto quota Bitcoin Spot di lungo periodo',
      },
      {
        id: 'TX_INIT_AAPL',
        instrumentId: 'INST_AAPL_XNGS_EQ',
        instrumentTicker: 'AAPL',
        transactionType: 'BUY',
        quantity: 12,
        unitPrice: 220.5,
        fees: 1.0,
        currency: 'USD',
        fxRateToBase: 0.89,
        fxSource: 'ECB_FRANKFURTER',
        fxObservedAt: '2026-09-15T14:45:00Z',
        declaredBrokerCode: 'IBKR',
        executedAt: '2026-09-15T14:45:00Z',
        notes: 'Posizione azionaria core US Tech',
      },
    ],
    paperAccount: {
      name: 'Conto Paper Trading DemInvest (Virtuale)',
      baseCurrency: 'USD',
      initialCapital: 25000,
      cashBalance: 25000,
      defaultSpreadBps: 12,
      defaultSlippageBps: 8,
      defaultCommissionPct: 0.1,
      orders: [],
      positions: [],
      realizedPnlTotal: 0,
      unrealizedPnlTotal: 0,
      totalEquity: 25000,
      maxDrawdownPct: 0,
    },
    journalEntries: [
      {
        id: 'JRN_INIT_1',
        instrumentId: 'INST_BTC_USD_SPOT',
        title: 'Analisi struttura settimanale Bitcoin e gestione volatilità ATR',
        hypothesis:
          'Mantenimento del supporto dinamico SMA(20) giornaliero con riduzione della leva a zero (solo Spot).',
        outcomeReview: 'Struttura rispettata; nessun ingresso impulsivo su candele non chiuse.',
        emotionalState: 'Disciplinato / Neutrale',
        lessonsLearned: 'Attendere sempre la chiusura giornaliera UTC prima di validare un breakout.',
        createdAt: new Date().toISOString(),
      },
    ],
    aiMessages: [],
    aiToolLogs: [],
    schedulerStatus: {
      isRunning: true,
      mode: 'ACTIVE_BACKEND_CRON',
      intervalSeconds: 180,
      lastRunAt: null,
      nextScheduledRunAt: new Date(Date.now() + 180 * 1000).toISOString(),
      dailyApiBudget: Number(process.env.DAILY_API_CALL_BUDGET || 500),
      dailyApiCallsUsed: 0,
      recentRuns: [],
    },
    providerStats: {
      coingecko: { callsToday: 0, lastSuccessAt: null, lastTestedAt: null, lastError: null },
      twelvedata: { callsToday: 0, lastSuccessAt: null, lastTestedAt: null, lastError: null },
      alphavantage: { callsToday: 0, lastSuccessAt: null, lastTestedAt: null, lastError: null },
      ecb_frankfurter: { callsToday: 0, lastSuccessAt: null, lastTestedAt: null, lastError: null },
      fred: { callsToday: 0, lastSuccessAt: null, lastTestedAt: null, lastError: null },
      gemini: { callsToday: 0, lastSuccessAt: null, lastTestedAt: null, lastError: null },
    },
  };
}

let dbCache: PersistedDatabaseState | null = null;
let supabaseInitialPullDone = false;

export function getDbState(): PersistedDatabaseState {
  if (dbCache) return dbCache;
  if (activeNodeBridge) {
    const parsed = activeNodeBridge.readJsonFile<Partial<PersistedDatabaseState>>(DB_FILENAME);
    if (parsed) {
      dbCache = { ...getDefaultDbState(), ...parsed };
      return dbCache!;
    }
  }
  dbCache = getDefaultDbState();
  saveDbState(dbCache);
  return dbCache;
}

export function saveDbState(state: PersistedDatabaseState): void {
  dbCache = state;
  if (activeNodeBridge) {
    activeNodeBridge.writeJsonFile(DB_FILENAME, state);
  }
  void pushStateToSupabaseIfConfigured(state);
}

export async function pullStateFromSupabaseIfConfigured(): Promise<void> {
  if (supabaseInitialPullDone) return;
  const supabaseUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;

  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/app_state_store?id=eq.deminvest_primary_state&select=state_json`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (res.ok) {
      const rows = (await res.json()) as { state_json?: Partial<PersistedDatabaseState> }[];
      if (Array.isArray(rows) && rows[0]?.state_json) {
        dbCache = { ...getDefaultDbState(), ...rows[0].state_json };
        supabaseInitialPullDone = true;
      }
    }
  } catch {
    // Fallback al cache locale / default se Supabase non è raggiungibile
  }
}

export async function pushStateToSupabaseIfConfigured(
  stateToPush?: PersistedDatabaseState
): Promise<void> {
  const supabaseUrl = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;

  const state = stateToPush || getDbState();
  try {
    await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/app_state_store`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 'deminvest_primary_state',
        state_json: state,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Ignora errori transitori di rete verso Supabase REST
  }
}

// ------------------------------------------------------------------------------
// IN-MEMORY CACHE FOR QUOTES, CANDLES & FX RATES (WITH STRICT TTL)
// ------------------------------------------------------------------------------
const quoteCache = new Map<string, { quote: MarketQuote; expiresAtMs: number }>();
const candleCache = new Map<string, { candles: HistoricalCandle[]; expiresAtMs: number }>();
let fxCache: { table: FxRateTable; expiresAtMs: number } | null = null;

function recordProviderSuccess(providerId: string) {
  const db = getDbState();
  const stat = db.providerStats[providerId] || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };
  stat.callsToday += 1;
  stat.lastSuccessAt = new Date().toISOString();
  stat.lastTestedAt = stat.lastSuccessAt;
  stat.lastError = null;
  db.providerStats[providerId] = stat;
  db.schedulerStatus.dailyApiCallsUsed += 1;
  saveDbState(db);
}

function recordProviderError(providerId: string, errorMessage: string) {
  const db = getDbState();
  const stat = db.providerStats[providerId] || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };
  stat.callsToday += 1;
  stat.lastTestedAt = new Date().toISOString();
  stat.lastError = errorMessage;
  db.providerStats[providerId] = stat;
  saveDbState(db);
}

async function fetchJsonWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 7500,
  retries = 1
): Promise<unknown> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DemInvest-Personal-Intelligence/1.0',
          ...(options.headers || {}),
        },
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${response.statusText})`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 450 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr || new Error('Richiesta HTTP fallita');
}

// ------------------------------------------------------------------------------
// PROVIDER ADAPTERS: COINGECKO, TWELVE DATA, ALPHA VANTAGE, ECB FRANKFURTER, FRED
// ------------------------------------------------------------------------------

export async function fetchLiveFxRatesToBase(baseCurrency = 'EUR'): Promise<FxRateTable> {
  if (fxCache && fxCache.table.baseCurrency === baseCurrency && Date.now() < fxCache.expiresAtMs) {
    return fxCache.table;
  }

  try {
    const data = (await fetchJsonWithRetry(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}`
    )) as {
      base: string;
      date: string;
      rates: Record<string, number>;
    };

    recordProviderSuccess('ecb_frankfurter');

    // Frankfurter restituisce 1 base = X foreign -> quindi 1 foreign = (1 / X) base
    const ratesToBase: FxRateTable['ratesToBase'] = {
      [baseCurrency]: {
        rate: 1,
        source: 'BCE / Frankfurter Official Reference',
        date: data.date,
      },
    };
    for (const [curr, val] of Object.entries(data.rates || {})) {
      if (val > 0) {
        ratesToBase[curr] = {
          rate: +(1 / val).toFixed(6),
          source: 'BCE / Frankfurter Official Reference',
          date: data.date,
        };
      }
    }

    const table: FxRateTable = {
      baseCurrency,
      ratesToBase,
    };
    fxCache = { table, expiresAtMs: Date.now() + 30 * 60 * 1000 };
    return table;
  } catch (err) {
    recordProviderError(
      'ecb_frankfurter',
      err instanceof Error ? err.message : 'Errore connessione BCE Frankfurter'
    );
    // Tassi di riferimento BCE di emergenza con timestamp e nota esplicita
    return {
      baseCurrency,
      ratesToBase: {
        EUR: { rate: 1, source: 'BCE Fallback Cache', date: '2026-10-16' },
        USD: { rate: 0.8886, source: 'BCE Reference Cache (2026-10-16)', date: '2026-10-16' },
        GBP: { rate: 1.185, source: 'BCE Reference Cache (2026-10-16)', date: '2026-10-16' },
        CHF: { rate: 1.0785, source: 'BCE Reference Cache (2026-10-16)', date: '2026-10-16' },
      },
    };
  }
}

async function fetchCoinGeckoQuote(instrument: NegotiableInstrument): Promise<MarketQuote> {
  const secrets = loadRuntimeSecrets();
  const cgId = instrument.coingeckoId || instrument.providerSymbol || 'bitcoin';
  const headers: Record<string, string> = {};
  if (secrets.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = secrets.COINGECKO_API_KEY;
  }

  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(cgId)}&price_change_percentage=24h`;
  const data = (await fetchJsonWithRetry(url, { headers })) as Array<{
    id: string;
    current_price: number;
    high_24h: number;
    low_24h: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
    total_volume: number;
    market_cap: number;
    last_updated: string;
  }>;

  if (!Array.isArray(data) || data.length === 0 || !data[0].current_price) {
    throw new Error(`CoinGecko non ha restituito quotazioni per "${cgId}".`);
  }

  recordProviderSuccess('coingecko');
  const item = data[0];
  const now = new Date();
  const observedDate = item.last_updated ? new Date(item.last_updated) : now;
  const delaySec = Math.max(0, Math.round((now.getTime() - observedDate.getTime()) / 1000));
  const freshness = delaySec <= 90 ? 'REALTIME' : delaySec <= 900 ? 'DELAYED' : 'STALE';

  // Se lo strumento è il CFD su Bitcoin (AvaTrade), aggiungiamo l'avviso esplicito che il prezzo
  // proviene dal sottostante Spot CoinGecko e NON è il bid/ask eseguibile del broker OTC
  const isCfd = instrument.isDerivative;

  return {
    instrumentId: instrument.id,
    price: item.current_price,
    open: +(item.current_price - (item.price_change_24h || 0)).toFixed(4),
    high24h: item.high_24h || item.current_price,
    low24h: item.low_24h || item.current_price,
    previousClose: +(item.current_price - (item.price_change_24h || 0)).toFixed(4),
    changeAbs: +(item.price_change_24h || 0).toFixed(4),
    changePct: +(item.price_change_percentage_24h || 0).toFixed(2),
    volume24h: item.total_volume,
    marketCap: item.market_cap,
    currency: 'USD',
    providerId: 'coingecko',
    providerName: isCfd
      ? 'CoinGecko Spot Reference (Sottostante di Riferimento — Non Prezzo Eseguibile CFD)'
      : 'CoinGecko API v3 (Mercato Spot Globale)',
    venueMic: instrument.venueMic,
    observedAt: observedDate.toISOString(),
    fetchedAt: now.toISOString(),
    freshness,
    delaySeconds: delaySec,
    validity: 'VALID',
    isMarketOpen: true,
    isDemoData: false,
    statusMessage: isCfd
      ? 'ATTENZIONE: Prezzo indicativo del sottostante BTC Spot. Il CFD OTC applica spread bid/ask e costi overnight propri del broker.'
      : undefined,
  };
}

async function fetchCoinGeckoCandles(
  instrument: NegotiableInstrument,
  timeframe: CandleTimeframe
): Promise<HistoricalCandle[]> {
  const secrets = loadRuntimeSecrets();
  const cgId = instrument.coingeckoId || instrument.providerSymbol || 'bitcoin';
  const headers: Record<string, string> = {};
  if (secrets.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = secrets.COINGECKO_API_KEY;
  }

  const days = timeframe === '15m' || timeframe === '1h' ? 7 : timeframe === '4h' ? 30 : 90;
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(cgId)}/ohlc?vs_currency=usd&days=${days}`;
  const raw = (await fetchJsonWithRetry(url, { headers })) as Array<[number, number, number, number, number]>;

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`Nessuna serie OHLC ricevuta da CoinGecko per ${cgId}.`);
  }

  recordProviderSuccess('coingecko');
  return raw.map((row, idx) => {
    const timeSec = Math.floor(row[0] / 1000);
    return {
      time: timeSec,
      isoTime: new Date(row[0]).toISOString(),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: 0, // L'endpoint /ohlc di CoinGecko fornisce OHLC puro senza volume per barra
      isClosed: idx < raw.length - 1, // L'ultima barra in corso è marcata come potenzialmente aperta, le precedenti chiuse
      providerId: 'coingecko',
      isDemoData: false,
    };
  });
}

async function fetchTwelveDataQuote(instrument: NegotiableInstrument): Promise<MarketQuote> {
  const secrets = loadRuntimeSecrets();
  const symbol = instrument.providerSymbol;
  const hasPersonalKey = Boolean(secrets.TWELVE_DATA_API_KEY);
  const officialDemoAllowed = ['AAPL', 'EUR/USD', 'BTC/USD'].includes(symbol);

  if (!hasPersonalKey && !officialDemoAllowed) {
    const nowIso = new Date().toISOString();
    return {
      instrumentId: instrument.id,
      price: 0,
      changeAbs: 0,
      changePct: 0,
      currency: instrument.quoteCurrency,
      providerId: 'twelvedata',
      providerName: 'Twelve Data API',
      venueMic: instrument.venueMic,
      observedAt: nowIso,
      fetchedAt: nowIso,
      freshness: 'STALE',
      delaySeconds: 0,
      validity: 'SUSPENDED',
      isMarketOpen: false,
      isDemoData: false,
      statusMessage: `Quotazione live per ${instrument.ticker} non disponibile senza chiave API Twelve Data personale. Configura TWELVE_DATA_API_KEY in Impostazioni > Provider (oppure passa esplicitamente alla Modalità DEMO Didattica).`,
    };
  }

  const apiKey = hasPersonalKey ? secrets.TWELVE_DATA_API_KEY! : 'demo';
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const data = (await fetchJsonWithRetry(url)) as Record<string, unknown>;

  if (data.status === 'error' || !data.close) {
    throw new Error(String(data.message || `Risposta non valida da Twelve Data per ${symbol}`));
  }

  recordProviderSuccess('twelvedata');
  const now = new Date();
  const price = Number(data.close);
  const open = Number(data.open || price);
  const high = Number(data.high || price);
  const low = Number(data.low || price);
  const prevClose = Number(data.previous_close || open);
  const changeAbs = Number(data.change || price - prevClose);
  const changePct = Number(data.percent_change || 0);
  const volume = data.volume ? Number(data.volume) : undefined;
  const isMarketOpen = Boolean(data.is_market_open);

  const quoteTsSec = Number(data.last_quote_at || data.timestamp || Math.floor(now.getTime() / 1000));
  const observedDate = new Date(quoteTsSec * 1000);
  const delaySec = Math.max(0, Math.round((now.getTime() - observedDate.getTime()) / 1000));

  return {
    instrumentId: instrument.id,
    price,
    open,
    high24h: high,
    low24h: low,
    previousClose: prevClose,
    changeAbs,
    changePct,
    volume24h: volume,
    currency: String(data.currency || instrument.quoteCurrency),
    providerId: 'twelvedata',
    providerName: hasPersonalKey
      ? 'Twelve Data API (Chiave Personale)'
      : 'Twelve Data API (Endpoint Ufficiale Sandbox)',
    venueMic: String(data.mic_code || instrument.venueMic),
    observedAt: observedDate.toISOString(),
    fetchedAt: now.toISOString(),
    freshness: isMarketOpen && delaySec <= 900 ? 'DELAYED' : 'EOD',
    delaySeconds: delaySec,
    validity: 'VALID',
    isMarketOpen,
    isDemoData: false,
  };
}

async function fetchTwelveDataCandles(
  instrument: NegotiableInstrument,
  timeframe: CandleTimeframe
): Promise<HistoricalCandle[]> {
  const secrets = loadRuntimeSecrets();
  const symbol = instrument.providerSymbol;
  const hasPersonalKey = Boolean(secrets.TWELVE_DATA_API_KEY);
  const officialDemoAllowed = ['AAPL', 'EUR/USD', 'BTC/USD'].includes(symbol);

  if (!hasPersonalKey && !officialDemoAllowed) {
    return [];
  }

  const apiKey = hasPersonalKey ? secrets.TWELVE_DATA_API_KEY! : 'demo';
  const intervalMap: Record<CandleTimeframe, string> = {
    '15m': '1day', // Nel piano base/sandbox usiamo 1day se intraday non autorizzato
    '1h': '1day',
    '4h': '1day',
    '1d': '1day',
    '1w': '1week',
  };
  const interval = hasPersonalKey
    ? ({ '15m': '15min', '1h': '1h', '4h': '4h', '1d': '1day', '1w': '1week' }[timeframe] || '1day')
    : intervalMap[timeframe];

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=60&apikey=${encodeURIComponent(apiKey)}`;
  const data = (await fetchJsonWithRetry(url)) as {
    status?: string;
    message?: string;
    values?: Array<{
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume?: string;
    }>;
  };

  if (!Array.isArray(data.values) || data.values.length === 0) {
    throw new Error(data.message || `Serie storica Twelve Data non disponibile per ${symbol}`);
  }

  recordProviderSuccess('twelvedata');
  const sorted = [...data.values].reverse();
  return sorted.map((v) => {
    const dt = new Date(v.datetime.includes(' ') ? v.datetime.replace(' ', 'T') + 'Z' : v.datetime + 'T00:00:00Z');
    const timeSec = Math.floor(dt.getTime() / 1000);
    return {
      time: timeSec,
      isoTime: dt.toISOString(),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: v.volume ? Number(v.volume) : 0,
      isClosed: true,
      providerId: 'twelvedata',
      isDemoData: false,
    };
  });
}

async function fetchAlphaVantageQuote(instrument: NegotiableInstrument): Promise<MarketQuote> {
  const secrets = loadRuntimeSecrets();
  const symbol = instrument.providerSymbol;
  const hasPersonalKey = Boolean(secrets.ALPHA_VANTAGE_API_KEY);
  const officialDemoAllowed = symbol === 'IBM';

  if (!hasPersonalKey && !officialDemoAllowed) {
    const nowIso = new Date().toISOString();
    return {
      instrumentId: instrument.id,
      price: 0,
      changeAbs: 0,
      changePct: 0,
      currency: instrument.quoteCurrency,
      providerId: 'alphavantage',
      providerName: 'Alpha Vantage API',
      venueMic: instrument.venueMic,
      observedAt: nowIso,
      fetchedAt: nowIso,
      freshness: 'STALE',
      delaySeconds: 0,
      validity: 'SUSPENDED',
      isMarketOpen: false,
      isDemoData: false,
      statusMessage: `Richiede configurazione ALPHA_VANTAGE_API_KEY in Impostazioni > Provider.`,
    };
  }

  const apiKey = hasPersonalKey ? secrets.ALPHA_VANTAGE_API_KEY! : 'demo';
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const data = (await fetchJsonWithRetry(url)) as {
    'Global Quote'?: Record<string, string>;
  };

  const gq = data['Global Quote'];
  if (!gq || !gq['05. price']) {
    throw new Error(`Alpha Vantage non ha restituito GLOBAL_QUOTE per ${symbol}`);
  }

  recordProviderSuccess('alphavantage');
  const price = Number(gq['05. price']);
  const open = Number(gq['02. open'] || price);
  const high = Number(gq['03. high'] || price);
  const low = Number(gq['04. low'] || price);
  const prevClose = Number(gq['08. previous close'] || open);
  const changeAbs = Number(gq['09. change'] || price - prevClose);
  const changePct = Number((gq['10. change percent'] || '0').replace('%', ''));
  const volume = Number(gq['06. volume'] || 0);
  const latestDay = gq['07. latest trading day'] || new Date().toISOString().slice(0, 10);
  const observedIso = `${latestDay}T20:00:00.000Z`;
  const venueStatus = getMarketVenueStatus(instrument.venueMic);

  return {
    instrumentId: instrument.id,
    price,
    open,
    high24h: high,
    low24h: low,
    previousClose: prevClose,
    changeAbs,
    changePct,
    volume24h: volume,
    currency: instrument.quoteCurrency,
    providerId: 'alphavantage',
    providerName: hasPersonalKey
      ? 'Alpha Vantage API (Chiave Personale)'
      : 'Alpha Vantage API (Endpoint Ufficiale Sandbox)',
    venueMic: instrument.venueMic,
    observedAt: observedIso,
    fetchedAt: new Date().toISOString(),
    freshness: 'EOD',
    delaySeconds: Math.max(0, Math.round((Date.now() - new Date(observedIso).getTime()) / 1000)),
    validity: 'VALID',
    isMarketOpen: venueStatus.isOpen,
    isDemoData: false,
  };
}

async function fetchAlphaVantageCandles(
  instrument: NegotiableInstrument
): Promise<HistoricalCandle[]> {
  const secrets = loadRuntimeSecrets();
  const symbol = instrument.providerSymbol;
  const hasPersonalKey = Boolean(secrets.ALPHA_VANTAGE_API_KEY);
  if (!hasPersonalKey && symbol !== 'IBM') return [];

  const apiKey = hasPersonalKey ? secrets.ALPHA_VANTAGE_API_KEY! : 'demo';
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const data = (await fetchJsonWithRetry(url)) as {
    'Time Series (Daily)'?: Record<
      string,
      {
        '1. open': string;
        '2. high': string;
        '3. low': string;
        '4. close': string;
        '5. volume': string;
      }
    >;
  };

  const ts = data['Time Series (Daily)'];
  if (!ts) return [];

  recordProviderSuccess('alphavantage');
  const dates = Object.keys(ts).sort().slice(-60);
  return dates.map((d) => {
    const item = ts[d];
    const dt = new Date(`${d}T20:00:00Z`);
    return {
      time: Math.floor(dt.getTime() / 1000),
      isoTime: dt.toISOString(),
      open: Number(item['1. open']),
      high: Number(item['2. high']),
      low: Number(item['3. low']),
      close: Number(item['4. close']),
      volume: Number(item['5. volume'] || 0),
      isClosed: true,
      providerId: 'alphavantage',
      isDemoData: false,
    };
  });
}

/**
 * Ottiene la quotazione di uno strumento rispettando rigorosamente la distinzione
 * tra modalità LIVE (zero prezzi inventati) e modalità DEMO esplicita.
 */
export async function getMarketQuoteForInstrument(
  instrumentId: string,
  mode: DataExecutionMode = 'LIVE'
): Promise<MarketQuote> {
  const db = getDbState();
  const instrument = db.instruments.find((i) => i.id === instrumentId);
  if (!instrument) {
    throw new Error(`Strumento "${instrumentId}" non registrato in Universal Instrument Registry.`);
  }

  if (mode === 'DEMO') {
    return getExplicitDemoQuote(instrument);
  }

  const cacheKey = `${instrumentId}::LIVE`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAtMs) {
    return cached.quote;
  }

  try {
    let quote: MarketQuote;
    if (instrument.primaryProviderId === 'coingecko') {
      quote = await fetchCoinGeckoQuote(instrument);
    } else if (instrument.primaryProviderId === 'alphavantage') {
      quote = await fetchAlphaVantageQuote(instrument);
    } else {
      quote = await fetchTwelveDataQuote(instrument);
    }

    if (quote.validity === 'VALID') {
      quoteCache.set(cacheKey, {
        quote,
        expiresAtMs: Date.now() + 55 * 1000, // Cache di 55s per rispettare i rate limit
      });
    }
    return quote;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore acquisizione quotazione';
    recordProviderError(instrument.primaryProviderId, msg);
    const nowIso = new Date().toISOString();
    return {
      instrumentId: instrument.id,
      price: 0,
      changeAbs: 0,
      changePct: 0,
      currency: instrument.quoteCurrency,
      providerId: instrument.primaryProviderId,
      providerName: instrument.primaryProviderId.toUpperCase(),
      venueMic: instrument.venueMic,
      observedAt: nowIso,
      fetchedAt: nowIso,
      freshness: 'STALE',
      delaySeconds: 0,
      validity: 'SUSPENDED',
      isMarketOpen: false,
      isDemoData: false,
      statusMessage: `Provider ${instrument.primaryProviderId} temporaneamente non raggiungibile o rate-limited: ${msg}. Nessun prezzo inventato viene mostrato.`,
    };
  }
}

/**
 * Ottiene le candele storiche per uno strumento in modalità LIVE o DEMO esplicita.
 */
export async function getHistoricalCandlesForInstrument(
  instrumentId: string,
  timeframe: CandleTimeframe = '1d',
  mode: DataExecutionMode = 'LIVE'
): Promise<HistoricalCandle[]> {
  const db = getDbState();
  const instrument = db.instruments.find((i) => i.id === instrumentId);
  if (!instrument) {
    throw new Error(`Strumento "${instrumentId}" non trovato.`);
  }

  if (mode === 'DEMO') {
    return getExplicitDemoCandles(instrument, 60);
  }

  const cacheKey = `${instrumentId}::${timeframe}::LIVE`;
  const cached = candleCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAtMs) {
    return cached.candles;
  }

  try {
    let candles: HistoricalCandle[] = [];
    if (instrument.primaryProviderId === 'coingecko') {
      candles = await fetchCoinGeckoCandles(instrument, timeframe);
    } else if (instrument.primaryProviderId === 'alphavantage') {
      candles = await fetchAlphaVantageCandles(instrument);
    } else {
      candles = await fetchTwelveDataCandles(instrument, timeframe);
    }

    if (candles.length > 0) {
      candleCache.set(cacheKey, {
        candles,
        expiresAtMs: Date.now() + 5 * 60 * 1000,
      });
    }
    return candles;
  } catch (err) {
    recordProviderError(
      instrument.primaryProviderId,
      err instanceof Error ? err.message : 'Errore serie storica'
    );
    return [];
  }
}

/**
 * Ricerca strumenti nel Registro Universale + Ricerca Live su CoinGecko API
 */
export async function searchCatalogAndLiveProviders(query: string): Promise<{
  localMatches: NegotiableInstrument[];
  externalCoinGeckoMatches: Array<{
    coingeckoId: string;
    symbol: string;
    name: string;
    marketCapRank: number | null;
  }>;
}> {
  const db = getDbState();
  const q = query.trim().toLowerCase();
  const localMatches = db.instruments.filter(
    (i) =>
      i.ticker.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      (i.isin && i.isin.toLowerCase().includes(q)) ||
      (i.coingeckoId && i.coingeckoId.toLowerCase().includes(q))
  );

  if (q.length < 2) {
    return { localMatches, externalCoinGeckoMatches: [] };
  }

  try {
    const data = (await fetchJsonWithRetry(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`
    )) as {
      coins?: Array<{
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number | null;
      }>;
    };
    recordProviderSuccess('coingecko');
    const externalCoinGeckoMatches = (data.coins || []).slice(0, 6).map((c) => ({
      coingeckoId: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      marketCapRank: c.market_cap_rank,
    }));
    return { localMatches, externalCoinGeckoMatches };
  } catch {
    return { localMatches, externalCoinGeckoMatches: [] };
  }
}

/**
 * Registra dinamicamente un nuovo asset crypto trovato su CoinGecko nel Registro Universale
 */
export function registerCoinGeckoInstrumentInCatalog(params: {
  coingeckoId: string;
  symbol: string;
  name: string;
}): NegotiableInstrument {
  const db = getDbState();
  const cleanId = params.coingeckoId.trim().toLowerCase();
  const existing = db.instruments.find((i) => i.coingeckoId === cleanId && !i.isDerivative);
  if (existing) return existing;

  const assetId = `ASSET_CG_${cleanId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const instId = `INST_CG_${cleanId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_USD`;

  if (!db.assets.some((a) => a.id === assetId)) {
    db.assets.push({
      id: assetId,
      canonicalSymbol: params.symbol.toUpperCase(),
      name: params.name,
      assetClass: 'CRYPTO',
      coingeckoId: cleanId,
      baseCurrency: 'USD',
      sector: 'Digital Asset (CoinGecko Verified ID)',
      description: `Cripto-attività registrata dinamicamente tramite CoinGecko ID univoco "${cleanId}" per prevenire collisioni di simbolo.`,
    });
  }

  const newInst: NegotiableInstrument = {
    id: instId,
    underlyingAssetId: assetId,
    instrumentType: 'SPOT_CRYPTO',
    ticker: `${params.symbol.toUpperCase()}/USD`,
    name: `${params.name} Spot (USD)`,
    assetClass: 'CRYPTO',
    venueMic: 'CRYPTO_GLOBAL',
    venueName: 'Mercato Globale Spot Crypto',
    quoteCurrency: 'USD',
    baseAssetSymbol: params.symbol.toUpperCase(),
    quoteAssetSymbol: 'USD',
    coingeckoId: cleanId,
    isDerivative: false,
    primaryProviderId: 'coingecko',
    providerSymbol: cleanId,
    liquidityTier: 'MEDIUM',
  };

  db.instruments.push(newInst);
  saveDbState(db);
  return newInst;
}

// ------------------------------------------------------------------------------
// PROVIDER HEALTH DASHBOARD BUILDER
// ------------------------------------------------------------------------------
export function getProvidersHealthDashboard(): ProviderHealthInfo[] {
  const secrets = loadRuntimeSecrets();
  const db = getDbState();
  const budget = db.schedulerStatus.dailyApiBudget;

  const cgStat = db.providerStats.coingecko || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };
  const tdStat = db.providerStats.twelvedata || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };
  const avStat = db.providerStats.alphavantage || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };
  const ecbStat = db.providerStats.ecb_frankfurter || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };
  const fredStat = db.providerStats.fred || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };
  const gemStat = db.providerStats.gemini || {
    callsToday: 0,
    lastSuccessAt: null,
    lastTestedAt: null,
    lastError: null,
  };

  return [
    {
      id: 'coingecko',
      displayName: 'CoinGecko API v3 (Crypto Spot & Catalogo)',
      category: 'MARKET_DATA',
      status: cgStat.lastError
        ? 'ERROR'
        : cgStat.lastSuccessAt
          ? 'OPERATIONAL'
          : 'CONFIGURED',
      hasCredentials: Boolean(secrets.COINGECKO_API_KEY),
      credentialsSource: secrets.COINGECKO_API_KEY
        ? 'RUNTIME_BACKEND'
        : 'PUBLIC_OFFICIAL_NO_KEY',
      lastSuccessAt: cgStat.lastSuccessAt,
      lastTestedAt: cgStat.lastTestedAt,
      lastError: cgStat.lastError,
      knownRateLimits: secrets.COINGECKO_API_KEY
        ? 'Demo/Pro Key: 30 req/min'
        : 'Endpoint pubblico: ~10-30 req/min (con cache backend 55s)',
      callsToday: cgStat.callsToday,
      dailyBudgetLimit: budget,
      dataQualityStatus: 'HIGH',
      availableFeatures: [
        'Quotazioni Spot Crypto reali (BTC, ETH, SOL, LINK, ecc.)',
        'Serie storiche OHLC reali',
        'Ricerca catalogo globale per CoinGecko ID univoco',
      ],
      suspendedFeatures: [],
    },
    {
      id: 'twelvedata',
      displayName: 'Twelve Data API (Azioni, ETF, Forex)',
      category: 'MARKET_DATA',
      status: secrets.TWELVE_DATA_API_KEY
        ? tdStat.lastSuccessAt
          ? 'OPERATIONAL'
          : 'CONFIGURED'
        : 'OPERATIONAL_SANDBOX',
      hasCredentials: Boolean(secrets.TWELVE_DATA_API_KEY),
      credentialsSource: secrets.TWELVE_DATA_API_KEY
        ? 'RUNTIME_BACKEND'
        : 'SANDBOX_DEMO_KEY',
      lastSuccessAt: tdStat.lastSuccessAt,
      lastTestedAt: tdStat.lastTestedAt,
      lastError: tdStat.lastError,
      knownRateLimits: secrets.TWELVE_DATA_API_KEY
        ? 'Piano Basic/Pro: 8-800 req/min (800 crediti/giorno free)'
        : 'Modalità Sandbox Ufficiale: supporta live reale per AAPL e EUR/USD; chiave richiesta per altri simboli',
      callsToday: tdStat.callsToday,
      dailyBudgetLimit: budget,
      dataQualityStatus: secrets.TWELVE_DATA_API_KEY ? 'HIGH' : 'SANDBOX_LIMITED',
      availableFeatures: [
        'Quotazioni e candele storiche reali per AAPL (NASDAQ) e EUR/USD (Forex)',
        ...(secrets.TWELVE_DATA_API_KEY
          ? ['Copertura completa ETF europei (VWCE), azioni globali e materie prime']
          : []),
      ],
      suspendedFeatures: secrets.TWELVE_DATA_API_KEY
        ? []
        : ['Quotazioni live su ETF Xetra / Borsa Italiana (richiede TWELVE_DATA_API_KEY)'],
    },
    {
      id: 'alphavantage',
      displayName: 'Alpha Vantage API (Azioni NYSE/NASDAQ & Serie Storiche)',
      category: 'MARKET_DATA',
      status: secrets.ALPHA_VANTAGE_API_KEY
        ? avStat.lastSuccessAt
          ? 'OPERATIONAL'
          : 'CONFIGURED'
        : 'OPERATIONAL_SANDBOX',
      hasCredentials: Boolean(secrets.ALPHA_VANTAGE_API_KEY),
      credentialsSource: secrets.ALPHA_VANTAGE_API_KEY
        ? 'RUNTIME_BACKEND'
        : 'SANDBOX_DEMO_KEY',
      lastSuccessAt: avStat.lastSuccessAt,
      lastTestedAt: avStat.lastTestedAt,
      lastError: avStat.lastError,
      knownRateLimits: secrets.ALPHA_VANTAGE_API_KEY
        ? 'Free Key: 25 req/giorno | Premium: 75+ req/min'
        : 'Modalità Sandbox Ufficiale: supporta live reale EOD per IBM (NYSE)',
      callsToday: avStat.callsToday,
      dailyBudgetLimit: budget,
      dataQualityStatus: secrets.ALPHA_VANTAGE_API_KEY ? 'HIGH' : 'SANDBOX_LIMITED',
      availableFeatures: [
        'GLOBAL_QUOTE e TIME_SERIES_DAILY reale per IBM (NYSE)',
        ...(secrets.ALPHA_VANTAGE_API_KEY ? ['Ricerca azioni globali, fondamentali e news sentiment'] : []),
      ],
      suspendedFeatures: secrets.ALPHA_VANTAGE_API_KEY
        ? []
        : ['Simboli aggiuntivi oltre IBM e feed News Sentiment (richiede ALPHA_VANTAGE_API_KEY)'],
    },
    {
      id: 'ecb_frankfurter',
      displayName: 'Banca Centrale Europea (Frankfurter FX API)',
      category: 'FX_RATES',
      status: ecbStat.lastError ? 'ERROR' : 'OPERATIONAL',
      hasCredentials: true,
      credentialsSource: 'PUBLIC_OFFICIAL_NO_KEY',
      lastSuccessAt: ecbStat.lastSuccessAt,
      lastTestedAt: ecbStat.lastTestedAt,
      lastError: ecbStat.lastError,
      knownRateLimits: 'Dato istituzionale pubblico BCE (aggiornato ogni giorno lavorativo alle 16:00 CET)',
      callsToday: ecbStat.callsToday,
      dailyBudgetLimit: budget,
      dataQualityStatus: 'HIGH',
      availableFeatures: [
        'Tassi di cambio ufficiali EUR/USD, EUR/GBP, EUR/CHF, EUR/JPY per conversioni portafoglio',
      ],
      suspendedFeatures: [],
    },
    {
      id: 'fred',
      displayName: 'FRED — Federal Reserve Bank of St. Louis (Macro)',
      category: 'MACRO',
      status: secrets.FRED_API_KEY
        ? fredStat.lastSuccessAt
          ? 'OPERATIONAL'
          : 'CONFIGURED'
        : 'UNCONFIGURED',
      hasCredentials: Boolean(secrets.FRED_API_KEY),
      credentialsSource: secrets.FRED_API_KEY ? 'RUNTIME_BACKEND' : 'MISSING',
      lastSuccessAt: fredStat.lastSuccessAt,
      lastTestedAt: fredStat.lastTestedAt,
      lastError: fredStat.lastError,
      knownRateLimits: '120 req/min con API Key gratuita FRED',
      callsToday: fredStat.callsToday,
      dailyBudgetLimit: budget,
      dataQualityStatus: secrets.FRED_API_KEY ? 'HIGH' : 'UNAVAILABLE',
      availableFeatures: secrets.FRED_API_KEY
        ? ['Serie storiche CPIAUCSL, FEDFUNDS, GDP, UNRATE aggiornate in tempo reale']
        : [],
      suspendedFeatures: secrets.FRED_API_KEY
        ? []
        : ['Sincronizzazione live serie FRED (configura FRED_API_KEY in Impostazioni)'],
    },
    {
      id: 'gemini',
      displayName: 'Google Gemini AI Engine (Tool-Calling Autorizzato)',
      category: 'AI_ENGINE',
      status: secrets.GEMINI_API_KEY
        ? gemStat.lastSuccessAt
          ? 'OPERATIONAL'
          : 'CONFIGURED'
        : 'CONFIGURED',
      hasCredentials: Boolean(secrets.GEMINI_API_KEY),
      credentialsSource: secrets.GEMINI_API_KEY ? 'RUNTIME_BACKEND' : 'MISSING',
      lastSuccessAt: gemStat.lastSuccessAt,
      lastTestedAt: gemStat.lastTestedAt,
      lastError: gemStat.lastError,
      knownRateLimits: secrets.GEMINI_API_KEY
        ? 'Gemini 2.5 Flash API (Backend Tool-Calling attivo)'
        : 'Motore Deterministico Tool-Based attivo (Configura GEMINI_API_KEY per sintesi generativa LLM)',
      callsToday: gemStat.callsToday,
      dailyBudgetLimit: budget,
      dataQualityStatus: 'HIGH',
      availableFeatures: [
        'Esecuzione controllata tool backend (get_market_quote, calculate_technical_indicators, get_portfolio_summary, calculate_scenario)',
        'Audit log completo in ai_tool_execution_logs',
        ...(secrets.GEMINI_API_KEY ? ['Sintesi conversazionale generativa Gemini 2.5 Flash'] : []),
      ],
      suspendedFeatures: secrets.GEMINI_API_KEY
        ? []
        : ['Sintesi generativa LLM (opera in modalità Analista Deterministico Tool-Based verificato)'],
    },
  ];
}

// ------------------------------------------------------------------------------
// WEB PUSH ENGINE (VAPID RFC 8292) & QUIET HOURS GUARD
// ------------------------------------------------------------------------------
function isWithinQuietHours(quietStart = '22:30', quietEnd = '07:30', now = new Date()): boolean {
  try {
    const [sh, sm] = quietStart.split(':').map(Number);
    const [eh, em] = quietEnd.split(':').map(Number);
    const curMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin <= endMin) {
      return curMin >= startMin && curMin < endMin;
    }
    return curMin >= startMin || curMin < endMin;
  } catch {
    return false;
  }
}

export async function dispatchNotificationAndWebPush(params: {
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  providerSource: string;
  observedTimestamp: string;
  instrumentId?: string;
  instrumentTicker?: string;
  horizon?: TimeHorizon;
  signalId?: string;
  alertRuleId?: string;
  bypassQuietHours?: boolean;
  quantitativeDetails?: NotificationItem['quantitativeDetails'];
}): Promise<NotificationItem> {
  const db = getDbState();
  const vapid = getOrInitVapidKeys();

  const quietStart = db.ownerAccount?.user.quietHoursStart || '22:30';
  const quietEnd = db.ownerAccount?.user.quietHoursEnd || '07:30';
  const inQuietHours =
    !params.bypassQuietHours &&
    params.severity !== 'CRITICAL' &&
    isWithinQuietHours(quietStart, quietEnd);

  let deliveryStatus: NotificationItem['deliveryStatus'] = inQuietHours
    ? 'SUPPRESSED_QUIET_HOURS'
    : 'SENT';

  if (!inQuietHours && db.pushSubscriptions.length > 0 && activeNodeBridge) {
    const pushPayload = JSON.stringify({
      title: params.title,
      body: params.body,
      tag: params.signalId || params.alertRuleId || `deminvest-${Date.now()}`,
      severity: params.severity,
      url: params.instrumentId ? `/markets?instrument=${params.instrumentId}` : '/notifications',
      signalId: params.signalId,
      assetId: params.instrumentId,
      timestamp: new Date().toISOString(),
    });

    const validSubs: PushSubscriptionItem[] = [];
    for (const sub of db.pushSubscriptions) {
      try {
        await activeNodeBridge.sendWebPush(vapid, sub, pushPayload);
        deliveryStatus = 'DELIVERED';
        validSubs.push(sub);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // Rimuove subscription scadute o revocate (404 / 410 Gone)
        if (statusCode !== 404 && statusCode !== 410) {
          validSubs.push(sub);
        }
      }
    }
    db.pushSubscriptions = validSubs;
  }

  const item: NotificationItem = {
    id: `NOTIF_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    signalId: params.signalId,
    alertRuleId: params.alertRuleId,
    instrumentId: params.instrumentId,
    instrumentTicker: params.instrumentTicker,
    horizon: params.horizon,
    title: params.title,
    body: params.body,
    channel: db.pushSubscriptions.length > 0 ? 'WEB_PUSH' : 'IN_APP',
    deliveryStatus,
    severity: params.severity,
    providerSource: params.providerSource,
    observedTimestamp: params.observedTimestamp,
    sentAt: new Date().toISOString(),
    quantitativeDetails: params.quantitativeDetails,
  };

  db.notifications = [item, ...db.notifications].slice(0, 100);
  saveDbState(db);
  return item;
}

// ------------------------------------------------------------------------------
// BACKEND SCHEDULER JOB (PRIORITY QUEUE, SIGNAL EVALUATION, ALERT RULES)
// ------------------------------------------------------------------------------
let isJobCurrentlyExecuting = false;

export async function runBackendSchedulerCycle(
  mode: DataExecutionMode = 'LIVE'
): Promise<SchedulerStatusInfo> {
  const db = getDbState();
  if (isJobCurrentlyExecuting) {
    return db.schedulerStatus;
  }

  if (db.schedulerStatus.dailyApiCallsUsed >= db.schedulerStatus.dailyApiBudget && mode === 'LIVE') {
    const skippedRun = {
      id: `RUN_${Date.now()}`,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'SKIPPED_BUDGET' as const,
      instrumentsChecked: 0,
      signalsGenerated: 0,
      notificationsSent: 0,
      apiCallsUsed: 0,
    };
    db.schedulerStatus.recentRuns = [skippedRun, ...db.schedulerStatus.recentRuns].slice(0, 20);
    saveDbState(db);
    return db.schedulerStatus;
  }

  isJobCurrentlyExecuting = true;
  const startedAt = new Date().toISOString();
  const callsBefore = db.schedulerStatus.dailyApiCallsUsed;
  let instrumentsChecked = 0;
  let signalsGenerated = 0;
  let notificationsSent = 0;

  try {
    // Ordine di priorità (Sezione 19):
    // 1. Asset con alert attivi
    // 2. Watchlist
    // 3. Asset del portafoglio
    const priorityIds = new Set<string>();
    for (const r of db.alertRules) {
      if (r.isActive) priorityIds.add(r.instrumentId);
    }
    for (const id of db.watchlistInstrumentIds) {
      priorityIds.add(id);
    }
    for (const tx of db.portfolioTransactions) {
      if (tx.instrumentId) priorityIds.add(tx.instrumentId);
    }

    const targetIds = Array.from(priorityIds).slice(0, 6);

    for (const instId of targetIds) {
      const instrument = db.instruments.find((i) => i.id === instId);
      if (!instrument) continue;

      const quote = await getMarketQuoteForInstrument(instId, mode);
      instrumentsChecked += 1;

      if (quote.validity !== 'VALID') continue;

      // 1. Aggiorna ciclo di vita dei segnali esistenti (EXPIRED, INVALIDATED, CONFIRMED)
      for (const existingSig of db.generatedSignals) {
        if (existingSig.instrumentId === instId) {
          const transition = evaluateSignalLifecycleTransition(existingSig, quote);
          if (transition.transitionOccurred) {
            existingSig.status = transition.updatedStatus;
            existingSig.statusUpdatedAt = new Date().toISOString();
            if (transition.updatedStatus === 'INVALIDATED') {
              await dispatchNotificationAndWebPush({
                title: `DemInvest — Segnale Invalidato su ${instrument.ticker}`,
                body: `${transition.reason} Fonte: ${quote.providerName}.`,
                severity: 'WARNING',
                providerSource: quote.providerName,
                observedTimestamp: quote.observedAt,
                instrumentId: instId,
                instrumentTicker: instrument.ticker,
                signalId: existingSig.id,
              });
              notificationsSent += 1;
            }
          }
        }
      }

      // 2. Acquisisci candele e calcola indicatori deterministici
      const candles = await getHistoricalCandlesForInstrument(instId, '1d', mode);
      if (candles.length >= 15) {
        const indicators = computeQuantitativeSnapshot(
          instId,
          '1d',
          candles,
          instrument.assetClass === 'CRYPTO' ? 'CRYPTO' : 'OTHER'
        );

        const verifiedMapping = db.brokerMappings.find(
          (m) => m.instrumentId === instId && m.verificationStatus !== 'UNVERIFIED'
        );

        const evaluatedSignal = evaluateDeterministicSignal({
          instrument,
          quote,
          indicators,
          horizon: 'BREVE',
          verifiedMapping,
        });

        // Registra se non duplicato
        if (!isDuplicateSignal(evaluatedSignal.dedupHash, db.generatedSignals, 120)) {
          db.generatedSignals = [evaluatedSignal, ...db.generatedSignals].slice(0, 80);
          signalsGenerated += 1;

          if (evaluatedSignal.signalType !== 'NO_TRADE') {
            await dispatchNotificationAndWebPush({
              title: `DemInvest — ${evaluatedSignal.signalType} rilevato su ${instrument.ticker}`,
              body: `${evaluatedSignal.quantitativeRationale} Stato: ${evaluatedSignal.status}. Verifica sempre condizioni e rischi.`,
              severity: evaluatedSignal.signalType === 'RISK_ALERT' ? 'HIGH' : 'INFO',
              providerSource: quote.providerName,
              observedTimestamp: quote.observedAt,
              instrumentId: instId,
              instrumentTicker: instrument.ticker,
              horizon: evaluatedSignal.horizon,
              signalId: evaluatedSignal.id,
              quantitativeDetails: {
                signalStatus: evaluatedSignal.status,
                invalidationLevel: evaluatedSignal.invalidationLevel,
                interestLevel: evaluatedSignal.interestLevel,
                rationale: evaluatedSignal.quantitativeRationale,
                risks: evaluatedSignal.keyRisks,
              },
            });
            notificationsSent += 1;
          }
        }

        // 3. Valuta regole di alert personalizzate dell'utente
        const triggeredRules = evaluateUserAlertRules({
          rules: db.alertRules,
          quote,
          indicators,
        });
        for (const tr of triggeredRules) {
          tr.triggeredRule.lastTriggeredAt = new Date().toISOString();
          await dispatchNotificationAndWebPush({
            title: tr.title,
            body: tr.body,
            severity: tr.severity,
            providerSource: quote.providerName,
            observedTimestamp: quote.observedAt,
            instrumentId: instId,
            instrumentTicker: instrument.ticker,
            alertRuleId: tr.triggeredRule.id,
          });
          notificationsSent += 1;
        }
      }
    }

    const completedAt = new Date().toISOString();
    const apiCallsUsed = Math.max(0, db.schedulerStatus.dailyApiCallsUsed - callsBefore);
    db.schedulerStatus.lastRunAt = completedAt;
    db.schedulerStatus.nextScheduledRunAt = new Date(
      Date.now() + db.schedulerStatus.intervalSeconds * 1000
    ).toISOString();
    db.schedulerStatus.recentRuns = [
      {
        id: `RUN_${Date.now()}`,
        startedAt,
        completedAt,
        status: 'COMPLETED' as const,
        instrumentsChecked,
        signalsGenerated,
        notificationsSent,
        apiCallsUsed,
      },
      ...db.schedulerStatus.recentRuns,
    ].slice(0, 20);
    saveDbState(db);
  } catch {
    const completedAt = new Date().toISOString();
    db.schedulerStatus.recentRuns = [
      {
        id: `RUN_${Date.now()}`,
        startedAt,
        completedAt,
        status: 'FAILED' as const,
        instrumentsChecked,
        signalsGenerated,
        notificationsSent,
        apiCallsUsed: 0,
      },
      ...db.schedulerStatus.recentRuns,
    ].slice(0, 20);
    saveDbState(db);
  } finally {
    isJobCurrentlyExecuting = false;
  }

  return db.schedulerStatus;
}

// ------------------------------------------------------------------------------
// DEMINVEST AI ENGINE (AUTHORIZED BACKEND TOOLS & ANTI-HALLUCINATION)
// ------------------------------------------------------------------------------

/**
 * Sanitizza input utente e testi esterni contro tentativi di prompt injection
 * o richieste di esecuzione ordini sul broker.
 */
export function sanitizeUserPromptAndGuardOrders(rawInput: string): {
  sanitized: string;
  blockedOrderAttempt: boolean;
} {
  const cleaned = rawInput
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/ignore previous instructions/gi, '[FILTRATO_SICUREZZA]')
    .replace(/system override/gi, '[FILTRATO_SICUREZZA]')
    .trim()
    .slice(0, 2000);

  const orderPattern =
    /\b(esegui ordine|compra subito sul broker|vendi subito sul broker|invia ordine a trade republic|execute market order)\b/i;
  return {
    sanitized: cleaned,
    blockedOrderAttempt: orderPattern.test(cleaned),
  };
}

export async function processContextualAiChat(params: {
  userPrompt: string;
  contextInstrumentId: string;
  activeHorizon: TimeHorizon;
  selectedBrokerCode: string;
  dataExecutionMode: DataExecutionMode;
}): Promise<AIChatMessage> {
  const db = getDbState();
  const secrets = loadRuntimeSecrets();
  const { sanitized, blockedOrderAttempt } = sanitizeUserPromptAndGuardOrders(params.userPrompt);

  const userMsg: AIChatMessage = {
    id: `AIMSG_U_${Date.now()}`,
    role: 'user',
    content: sanitized,
    createdAt: new Date().toISOString(),
    engineMode: secrets.GEMINI_API_KEY ? 'GEMINI_LLM_TOOL_VERIFIED' : 'DETERMINISTIC_TOOL_ANALYST',
    toolCalls: [],
    sources: [],
  };
  db.aiMessages.push(userMsg);

  if (blockedOrderAttempt) {
    const blockedReply: AIChatMessage = {
      id: `AIMSG_A_${Date.now() + 1}`,
      role: 'assistant',
      content:
        'Blocco di Sicurezza Operativa: DemInvest è una piattaforma di market intelligence e supporto decisionale, NON un broker. Per vincolo architetturale non negoziabile, DemInvest AI non possiede alcun permesso né strumento per inviare o eseguire ordini sui tuoi intermediari.',
      createdAt: new Date().toISOString(),
      engineMode: 'DETERMINISTIC_TOOL_ANALYST',
      structuredSections: {
        verifiedData: ['Richiesta di esecuzione ordine intercettata e bloccata dal guardrail di sicurezza.'],
        quantitativeCalculations: [],
        technicalInterpretations: ['Nessuna operazione eseguita.'],
        hypothesesAndScenarios: [
          'Puoi testare liberamente questa idea nel modulo Paper Trading (Trading Lab) usando capitale virtuale.',
        ],
        limitationsAndSources: ['Vincolo di sicurezza DemInvest Sezione 1 e Sezione 13.'],
      },
      toolCalls: [],
      sources: [],
    };
    db.aiMessages.push(blockedReply);
    saveDbState(db);
    return blockedReply;
  }

  // Determina lo strumento richiesto nel testo o usa quello aperto nel contesto
  let targetInstrument =
    db.instruments.find((i) => i.id === params.contextInstrumentId) || db.instruments[0];
  const lower = sanitized.toLowerCase();
  for (const inst of db.instruments) {
    if (
      lower.includes(inst.ticker.toLowerCase()) ||
      lower.includes(inst.name.toLowerCase().split(' ')[0].toLowerCase())
    ) {
      targetInstrument = inst;
      break;
    }
  }

  const toolCalls: AIToolCallLog[] = [];
  const sources: { provider: string; timestamp: string; description: string }[] = [];

  // Tool 1: get_asset_metadata
  const t0 = Date.now();
  const underlyingAsset = db.assets.find((a) => a.id === targetInstrument.underlyingAssetId);
  const brokerMap = db.brokerMappings.find(
    (m) =>
      m.instrumentId === targetInstrument.id &&
      (!params.selectedBrokerCode || m.brokerCode === params.selectedBrokerCode)
  );
  toolCalls.push({
    id: `TOOL_${Date.now()}_META`,
    toolName: 'get_asset_metadata',
    inputParams: { instrumentId: targetInstrument.id, brokerCode: params.selectedBrokerCode },
    outputSummary: {
      ticker: targetInstrument.ticker,
      instrumentType: targetInstrument.instrumentType,
      isin: targetInstrument.isin || null,
      coingeckoId: targetInstrument.coingeckoId || null,
      brokerSymbol: brokerMap?.brokerSymbol || 'NON_MAPPATO',
      verificationStatus: brokerMap?.verificationStatus || 'UNVERIFIED',
    },
    executionMs: Math.max(1, Date.now() - t0),
    status: 'SUCCESS',
    executedAt: new Date().toISOString(),
  });

  // Tool 2: get_market_quote
  const t1 = Date.now();
  const quote = await getMarketQuoteForInstrument(targetInstrument.id, params.dataExecutionMode);
  toolCalls.push({
    id: `TOOL_${Date.now()}_QUOTE`,
    toolName: 'get_market_quote',
    inputParams: { instrumentId: targetInstrument.id, mode: params.dataExecutionMode },
    outputSummary: {
      price: quote.price,
      currency: quote.currency,
      changePct: quote.changePct,
      provider: quote.providerName,
      freshness: quote.freshness,
      validity: quote.validity,
      observedAt: quote.observedAt,
    },
    executionMs: Math.max(1, Date.now() - t1),
    status: quote.validity === 'VALID' ? 'SUCCESS' : 'ERROR',
    executedAt: new Date().toISOString(),
  });

  if (quote.validity === 'VALID') {
    sources.push({
      provider: quote.providerName,
      timestamp: quote.observedAt,
      description: `Quotazione ${targetInstrument.ticker}: ${quote.price} ${quote.currency} (${quote.freshness})`,
    });
  }

  // Tool 3: get_historical_candles & calculate_technical_indicators
  const t2 = Date.now();
  const candles = await getHistoricalCandlesForInstrument(
    targetInstrument.id,
    '1d',
    params.dataExecutionMode
  );
  const indicators = computeQuantitativeSnapshot(
    targetInstrument.id,
    '1d',
    candles,
    targetInstrument.assetClass === 'CRYPTO' ? 'CRYPTO' : 'OTHER'
  );
  toolCalls.push({
    id: `TOOL_${Date.now()}_QUANT`,
    toolName: 'calculate_technical_indicators',
    inputParams: { instrumentId: targetInstrument.id, timeframe: '1d', candlesCount: candles.length },
    outputSummary: {
      sufficientData: indicators.sufficientData,
      rsi14: indicators.rsi14,
      sma20: indicators.sma20,
      sma50: indicators.sma50,
      atr14: indicators.atr14,
      trendDirection: indicators.trendDirection,
      supportsCount: indicators.supports.length,
      resistancesCount: indicators.resistances.length,
    },
    executionMs: Math.max(1, Date.now() - t2),
    status: indicators.sufficientData ? 'SUCCESS' : 'ERROR',
    executedAt: new Date().toISOString(),
  });

  // Tool 4: get_portfolio_summary
  const t3 = Date.now();
  const fxTable = await fetchLiveFxRatesToBase('EUR');
  const quotesMap: Record<string, MarketQuote | undefined> = {
    [targetInstrument.id]: quote,
  };
  const portfolioSummary = calculatePortfolioAnalytics({
    transactions: db.portfolioTransactions,
    quotesByInstrumentId: quotesMap,
    fxTable,
    instruments: db.instruments,
  });
  toolCalls.push({
    id: `TOOL_${Date.now()}_PORTFOLIO`,
    toolName: 'get_portfolio_summary',
    inputParams: { baseCurrency: 'EUR' },
    outputSummary: {
      totalInvestedEur: portfolioSummary.totalInvestedCostInBase,
      positionsCount: portfolioSummary.positions.length,
      concentrationLevel: portfolioSummary.concentrationRisk.concentrationLevel,
      topPosition: portfolioSummary.concentrationRisk.topPositionTicker,
    },
    executionMs: Math.max(1, Date.now() - t3),
    status: 'SUCCESS',
    executedAt: new Date().toISOString(),
  });

  sources.push({
    provider: 'BCE / Frankfurter FX Reference',
    timestamp: new Date().toISOString(),
    description: 'Tassi di conversione valutaria per il calcolo di portafoglio',
  });

  // Tool 5: calculate_scenario (Simulazione parametrica +/- 1.5x ATR e +/- 2.5x ATR)
  const t4 = Date.now();
  const atrVal = indicators.atr14 ?? (quote.price > 0 ? quote.price * 0.025 : 0);
  const scenarioUp = quote.price > 0 ? +(quote.price + 2 * atrVal).toFixed(4) : 0;
  const scenarioDown = quote.price > 0 ? +(quote.price - 1.8 * atrVal).toFixed(4) : 0;
  toolCalls.push({
    id: `TOOL_${Date.now()}_SCENARIO`,
    toolName: 'calculate_scenario',
    inputParams: {
      instrumentId: targetInstrument.id,
      basePrice: quote.price,
      atr14: atrVal,
    },
    outputSummary: {
      bullishTarget2Atr: scenarioUp,
      bearishInvalidation1_8Atr: scenarioDown,
    },
    executionMs: Math.max(1, Date.now() - t4),
    status: 'SUCCESS',
    executedAt: new Date().toISOString(),
  });

  // Registra tutti i tool log
  db.aiToolLogs = [...toolCalls, ...db.aiToolLogs].slice(0, 150);

  // Costruzione delle 5 sezioni obbligatorie anti-allucinazione (Sezione 13)
  const verifiedData: string[] = [];
  if (quote.validity === 'VALID') {
    verifiedData.push(
      `Strumento selezionato: ${targetInstrument.name} (${targetInstrument.ticker}) — Tipo: ${targetInstrument.instrumentType} su ${targetInstrument.venueName} (MIC: ${targetInstrument.venueMic}).`
    );
    verifiedData.push(
      `Quotazione verificata: ${quote.price} ${quote.currency} (Variazione 24h: ${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%) | Fonte: ${quote.providerName} | Rilevato: ${quote.observedAt} | Stato freschezza: ${quote.freshness} (ritardo ${quote.delaySeconds}s).`
    );
  } else {
    verifiedData.push(
      `DATI INSUFFICIENTI PER QUOTAZIONE LIVE: Lo strumento ${targetInstrument.ticker} ha stato "${quote.validity}". Motivo: ${quote.statusMessage || 'Provider non configurato'}. Nessun prezzo viene inventato.`
    );
  }

  if (brokerMap) {
    verifiedData.push(
      `Mappatura Piattaforma (${brokerMap.brokerName}): Simbolo "${brokerMap.brokerSymbol}" | Contratto: ${brokerMap.contractType} | Stato verifica: ${brokerMap.verificationStatus}.`
    );
    if (brokerMap.spotVsDerivativeWarning) {
      verifiedData.push(brokerMap.spotVsDerivativeWarning);
    }
  } else {
    verifiedData.push(
      `Mappatura per la piattaforma "${params.selectedBrokerCode}": Stato UNVERIFIED (nessun simbolo broker viene inventato senza verifica).`
    );
  }

  const quantitativeCalculations: string[] = [];
  if (indicators.sufficientData) {
    quantitativeCalculations.push(
      `Trend (su ${indicators.observationsCount} candele chiuse): Direzione ${indicators.trendDirection} | SMA(20) = ${indicators.sma20 ?? 'N/D'} | SMA(50) = ${indicators.sma50 ?? 'N/D'} | EMA(20) = ${indicators.ema20 ?? 'N/D'} | ADX(14) = ${indicators.adx14 ?? 'N/D'}.`
    );
    quantitativeCalculations.push(
      `Momentum: RSI(14) = ${indicators.rsi14 ?? 'N/D'} | MACD Histogram = ${indicators.macd?.histogram ?? 'N/D'} | ROC(10) = ${indicators.roc10 !== null ? indicators.roc10 + '%' : 'N/D'}.`
    );
    quantitativeCalculations.push(
      `Volatilità e Rischio: ATR(14) = ${indicators.atr14 ?? 'N/D'} (${indicators.atrPct ?? 'N/D'}% del prezzo) | Volatilità Annualizzata = ${indicators.historicalVolatilityAnnualizedPct !== null ? indicators.historicalVolatilityAnnualizedPct + '%' : 'N/D'} | Max Drawdown finestra = ${indicators.maxDrawdownPct !== null ? indicators.maxDrawdownPct + '%' : 'N/D'}.`
    );
    quantitativeCalculations.push(
      `Supporti e Resistenze (${indicators.supportResistanceAlgorithmDoc.split(':')[0]}): Supporti chiave a [${indicators.supports.map((s) => s.price).join(', ') || 'Nessun cluster vicino'}] | Resistenze chiave a [${indicators.resistances.map((r) => r.price).join(', ') || 'Nessun cluster vicino'}].`
    );
  } else {
    quantitativeCalculations.push(
      `Calcoli tecnici sospesi: ${indicators.insufficientReason || 'Serie storica insufficiente'}.`
    );
  }

  quantitativeCalculations.push(
    `Contesto Portafoglio Manuale: Capitale investito a costo = ${portfolioSummary.totalInvestedCostInBase.toFixed(2)} EUR | Rischio concentrazione = ${portfolioSummary.concentrationRisk.concentrationLevel} (Indice HHI = ${portfolioSummary.concentrationRisk.herfindahlIndex}/10000).`
  );

  const technicalInterpretations: string[] = [];
  if (quote.validity === 'VALID' && indicators.sufficientData) {
    const evalSig = evaluateDeterministicSignal({
      instrument: targetInstrument,
      quote,
      indicators,
      horizon: params.activeHorizon,
      verifiedMapping: brokerMap,
    });
    technicalInterpretations.push(
      `Esito Signal Intelligence Engine sull'orizzonte ${params.activeHorizon}: ${evalSig.signalType} (Stato: ${evalSig.status}) — Punteggio euristico multifattoriale: ${evalSig.heuristicScore}/100 (non è una probabilità di profitto).`
    );
    technicalInterpretations.push(evalSig.quantitativeRationale);
    if (evalSig.conditionsUnmet.length > 0) {
      technicalInterpretations.push(
        `Condizioni non soddisfatte / da monitorare: ${evalSig.conditionsUnmet.join(' | ')}`
      );
    }
  } else {
    technicalInterpretations.push(
      'In assenza di dati verificati e serie storica completa, DemInvest AI si astiene dal formulare interpretazioni direzionali.'
    );
  }

  const hypothesesAndScenarios: string[] = [];
  if (quote.validity === 'VALID' && atrVal > 0) {
    hypothesesAndScenarios.push(
      `Scenario Costruttivo (Ipotesi condizionata): in caso di tenuta sopra ${indicators.sma20 ?? quote.price}, proiezione statistica a +2.0x ATR verso ${scenarioUp} ${quote.currency}.`
    );
    hypothesesAndScenarios.push(
      `Scenario di Invalidazione / Rischio: una discesa sotto ${scenarioDown} ${quote.currency} (-1.8x ATR) invalida la struttura di breve periodo.`
    );
  } else {
    hypothesesAndScenarios.push(
      'Nessuno scenario di prezzo calcolabile finché il provider dati per questo strumento non risulta operativo.'
    );
  }

  const limitationsAndSources: string[] = [
    `Orizzonte attivo nel contesto UI: ${params.activeHorizon}.`,
    `Modalità dati attiva: ${params.dataExecutionMode === 'DEMO' ? 'MODALITÀ DEMO DIDATTICA (Dati simulati)' : 'MODALITÀ LIVE REALE (Zero prezzi inventati)'}.`,
    'Avvertenza: Questa analisi ha finalità esclusivamente informative e di ricerca personale; non costituisce consulenza finanziaria personalizzata né promessa di rendimento.',
  ];

  let finalContent = [
    `### Analisi Contestuale DemInvest AI — ${targetInstrument.name} (${targetInstrument.ticker})`,
    `**1. Dati Verificati:**\n${verifiedData.map((d) => `- ${d}`).join('\n')}`,
    `**2. Calcoli Quantitativi Deterministici:**\n${quantitativeCalculations.map((c) => `- ${c}`).join('\n')}`,
    `**3. Interpretazioni Tecniche (${params.activeHorizon}):**\n${technicalInterpretations.map((i) => `- ${i}`).join('\n')}`,
    `**4. Ipotesi e Scenari di Rischio:**\n${hypothesesAndScenarios.map((h) => `- ${h}`).join('\n')}`,
    `**5. Limitazioni e Fonti:**\n${limitationsAndSources.map((l) => `- ${l}`).join('\n')}`,
  ].join('\n\n');

  let engineMode: AIChatMessage['engineMode'] = 'DETERMINISTIC_TOOL_ANALYST';

  // Se GEMINI_API_KEY è configurata nel backend, arricchisce la risposta tramite Gemini API
  // vincolandola rigorosamente ai soli dati restituiti dai tool appena eseguiti!
  if (secrets.GEMINI_API_KEY) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(secrets.GEMINI_API_KEY)}`;
      const systemPrompt = [
        'Sei DemInvest AI, assistente finanziario quantitativo privato in lingua italiana.',
        'REGOLE ANTI-ALLUCINAZIONE TASSATIVE:',
        '1. Usa ESCLUSIVAMENTE i numeri, prezzi, timestamp e indicatori presenti nel JSON dei tool verificati fornito qui sotto.',
        '2. Non inventare MAI prezzi, notizie, simboli broker o probabilità di successo.',
        '3. Distingui esplicitamente: Dati verificati, Calcoli quantitativi, Interpretazioni, Ipotesi e Limitazioni.',
        '4. Non promettere mai rendimenti e ricorda che un CFD è distinto dall\'asset spot.',
      ].join('\n');

      const geminiBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\nDATI VERIFICATI DAI TOOL BACKEND:\n${JSON.stringify(
                  {
                    verifiedData,
                    quantitativeCalculations,
                    technicalInterpretations,
                    hypothesesAndScenarios,
                  },
                  null,
                  2
                )}\n\nDOMANDA UTENTE: ${sanitized}`,
              },
            ],
          },
        ],
      };

      const geminiRes = (await fetchJsonWithRetry(
        geminiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        },
        10000,
        0
      )) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const llmText = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text;
      if (llmText) {
        finalContent = llmText;
        engineMode = 'GEMINI_LLM_TOOL_VERIFIED';
        recordProviderSuccess('gemini');
      }
    } catch (err) {
      recordProviderError(
        'gemini',
        err instanceof Error ? err.message : 'Errore chiamata Gemini API'
      );
    }
  }

  const assistantMsg: AIChatMessage = {
    id: `AIMSG_A_${Date.now() + 2}`,
    role: 'assistant',
    content: finalContent,
    createdAt: new Date().toISOString(),
    engineMode,
    structuredSections: {
      verifiedData,
      quantitativeCalculations,
      technicalInterpretations,
      hypothesesAndScenarios,
      limitationsAndSources,
    },
    toolCalls,
    sources,
  };

  db.aiMessages.push(assistantMsg);
  saveDbState(db);
  return assistantMsg;
}
