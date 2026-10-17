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
  AnalyzedInstrumentIntelligenceItem,
  BrokerInstrumentMapping,
  CandleTimeframe,
  DataExecutionMode,
  GeneratedSignal,
  HistoricalCandle,
  MarketQuote,
  MarketScanFilterParams,
  MarketScanRunResult,
  NegotiableInstrument,
  NotificationItem,
  PaperAccountState,
  PortfolioTransaction,
  PositionSimulationInput,
  PositionSimulationResult,
  ProviderHealthInfo,
  SchedulerStatusInfo,
  SupabaseSyncDiagnostics,
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
import {
  auditMarketDataQuality,
  computeQuantitativeSnapshot,
} from '../src/engines/quantitativeEngine';
import {
  detectMarketRegime,
  evaluateAllStrategiesForInstrument,
  evaluateMultiTimeframeConsensus,
  evaluateRiskIntelligence,
  HORIZON_PROFILES_V3,
  QUANTITATIVE_STRATEGIES_V3,
  runSmartMarketScanner,
  simulatePositionRisk,
} from '../src/engines/marketIntelligenceEngine';
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

export interface RuntimeSecrets {
  COINGECKO_API_KEY?: string;
  TWELVE_DATA_API_KEY?: string;
  ALPHA_VANTAGE_API_KEY?: string;
  FRED_API_KEY?: string;
  GEMINI_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
    SUPABASE_URL:
      getEnvVar('SUPABASE_URL') ||
      getEnvVar('VITE_SUPABASE_URL') ||
      memoryRuntimeSecrets.SUPABASE_URL ||
      fileSecrets.SUPABASE_URL ||
      'https://yumqptqhdlqcoudpxnrc.supabase.co',
    SUPABASE_ANON_KEY:
      getEnvVar('VITE_SUPABASE_ANON_KEY') ||
      getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
      getEnvVar('SUPABASE_ANON_KEY') ||
      getEnvVar('SUPABASE_PUBLISHABLE_KEY') ||
      memoryRuntimeSecrets.SUPABASE_ANON_KEY ||
      fileSecrets.SUPABASE_ANON_KEY ||
      '',
    SUPABASE_SERVICE_ROLE_KEY:
      getEnvVar('SUPABASE_SERVICE_ROLE_KEY') ||
      memoryRuntimeSecrets.SUPABASE_SERVICE_ROLE_KEY ||
      fileSecrets.SUPABASE_SERVICE_ROLE_KEY ||
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

export function saveDbState(state: PersistedDatabaseState, skipAutoPush = false): void {
  dbCache = state;
  if (activeNodeBridge) {
    activeNodeBridge.writeJsonFile(DB_FILENAME, state);
  }
  if (!skipAutoPush) {
    void pushStateToSupabaseIfConfigured(state);
  }
}

export function applyIncomingSupabaseHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): void {
  const getHeader = (name: string): string => {
    if (typeof (headers as Headers).get === 'function') {
      return ((headers as Headers).get(name) || '').trim();
    }
    const rec = headers as Record<string, string | string[] | undefined>;
    const v = rec[name] || rec[name.toLowerCase()];
    if (Array.isArray(v)) return (v[0] || '').trim();
    return (v || '').trim();
  };

  const anonHeader = getHeader('x-deminvest-supabase-anon-key');
  const serviceHeader = getHeader('x-deminvest-supabase-service-key');
  const urlHeader = getHeader('x-deminvest-supabase-url');

  if (anonHeader && !memoryRuntimeSecrets.SUPABASE_ANON_KEY) {
    saveRuntimeSecret('SUPABASE_ANON_KEY', anonHeader);
  }
  if (serviceHeader && !memoryRuntimeSecrets.SUPABASE_SERVICE_ROLE_KEY) {
    saveRuntimeSecret('SUPABASE_SERVICE_ROLE_KEY', serviceHeader);
  }
  if (urlHeader && urlHeader.startsWith('http') && !memoryRuntimeSecrets.SUPABASE_URL) {
    saveRuntimeSecret('SUPABASE_URL', urlHeader);
  }
}

let lastSupabaseDiagnostics: SupabaseSyncDiagnostics = {
  configuredUrl: 'https://yumqptqhdlqcoudpxnrc.supabase.co',
  hasAnonOrPublishableKey: false,
  hasServiceRoleKey: false,
  connectionStatus: 'MISSING_CREDENTIALS',
  authUserStatus: 'NOT_CHECKED_NO_KEY',
  profileStatus: 'NOT_CHECKED',
  lastSyncAt: null,
  lastError: null,
  remoteTableCounts: {
    profiles: 0,
    user_preferences: 0,
    watchlists: 0,
    portfolios: 0,
    portfolio_transactions: 0,
    alert_rules: 0,
    instruments: 0,
    application_settings: 0,
  },
  syncStepsLog: [],
};

function getSupabaseConfig(): {
  baseUrl: string;
  apiKey: string;
  anonKey: string;
  serviceRoleKey: string;
} | null {
  const secrets = loadRuntimeSecrets();
  const rawUrl = (
    secrets.SUPABASE_URL ||
    getEnvVar('SUPABASE_URL') ||
    getEnvVar('VITE_SUPABASE_URL') ||
    'https://yumqptqhdlqcoudpxnrc.supabase.co'
  ).trim();
  const serviceRoleKey = (secrets.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (secrets.SUPABASE_ANON_KEY || '').trim();
  const apiKey = serviceRoleKey || anonKey;

  lastSupabaseDiagnostics.configuredUrl = rawUrl.replace(/\/$/, '');
  lastSupabaseDiagnostics.hasAnonOrPublishableKey = Boolean(anonKey);
  lastSupabaseDiagnostics.hasServiceRoleKey = Boolean(serviceRoleKey);

  if (!rawUrl || !apiKey) {
    lastSupabaseDiagnostics.connectionStatus = 'MISSING_CREDENTIALS';
    return null;
  }
  return {
    baseUrl: rawUrl.replace(/\/$/, ''),
    apiKey,
    anonKey,
    serviceRoleKey,
  };
}

function buildSupabaseHeaders(
  apiKey: string,
  bearerToken?: string,
  extraHeaders?: Record<string, string>
): Record<string, string> {
  const token = (bearerToken || apiKey).trim();
  const headers: Record<string, string> = {
    apikey: apiKey,
    ...extraHeaders,
  };
  // Invia Authorization: Bearer sia per JWT (eyJ...) sia per chiavi Supabase compatibili
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function supabaseSmartFetch(
  url: string,
  apiKey: string,
  options: RequestInit & { bearerToken?: string; extraHeaders?: Record<string, string> } = {}
): Promise<Response> {
  const { bearerToken, extraHeaders, ...fetchOpts } = options;
  const firstHeaders = buildSupabaseHeaders(apiKey, bearerToken, extraHeaders);
  const res = await fetch(url, {
    ...fetchOpts,
    headers: firstHeaders,
  });

  // Se la chiave è nel nuovo formato non-JWT (`sb_publishable_` / `sb_secret_`) e PostgREST
  // rifiuta l'header Authorization: Bearer non-JWT con 401, riprova usando solo `apikey`.
  if (
    res.status === 401 &&
    (apiKey.startsWith('sb_') || (bearerToken && bearerToken.startsWith('sb_')))
  ) {
    const fallbackHeaders: Record<string, string> = {
      apikey: apiKey,
      ...extraHeaders,
    };
    return fetch(url, {
      ...fetchOpts,
      headers: fallbackHeaders,
    });
  }

  return res;
}

let cachedSupabaseUserAccessToken: string | null = null;

export function getSupabaseDiagnosticsSnapshot(): SupabaseSyncDiagnostics {
  getSupabaseConfig();
  return { ...lastSupabaseDiagnostics };
}

export async function pullStateFromSupabaseIfConfigured(force = false): Promise<void> {
  if (supabaseInitialPullDone && !force) return;
  const cfg = getSupabaseConfig();
  if (!cfg) return;

  const activeBearer = cfg.serviceRoleKey || cachedSupabaseUserAccessToken || cfg.apiKey;

  try {
    // 1. Legge da public.application_settings (sempre presente nello schema 0001)
    const settingsRes = await supabaseSmartFetch(
      `${cfg.baseUrl}/rest/v1/application_settings?key=eq.DEMINVEST_RUNTIME_STATE&select=value`,
      cfg.apiKey,
      { bearerToken: activeBearer, extraHeaders: { Accept: 'application/json' } }
    );
    if (settingsRes.ok) {
      lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
      const rows = (await settingsRes.json()) as { value?: Partial<PersistedDatabaseState> }[];
      if (Array.isArray(rows) && rows[0]?.value && typeof rows[0].value === 'object') {
        const currentOwner = dbCache?.ownerAccount;
        dbCache = {
          ...getDefaultDbState(),
          ...rows[0].value,
          ownerAccount: rows[0].value.ownerAccount || currentOwner || null,
        };
        if (dbCache.ownerAccount) {
          supabaseInitialPullDone = true;
          return;
        }
      }
    } else if (settingsRes.status === 401 || settingsRes.status === 403) {
      lastSupabaseDiagnostics.connectionStatus = 'AUTH_ERROR';
      lastSupabaseDiagnostics.lastError = `Autenticazione Supabase rifiutata (HTTP ${settingsRes.status})`;
    }

    // 2. Fallback a public.app_state_store
    const res = await supabaseSmartFetch(
      `${cfg.baseUrl}/rest/v1/app_state_store?id=eq.deminvest_primary_state&select=state_json`,
      cfg.apiKey,
      { bearerToken: activeBearer, extraHeaders: { Accept: 'application/json' } }
    );
    if (res.ok) {
      lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
      const rows = (await res.json()) as { state_json?: Partial<PersistedDatabaseState> }[];
      if (Array.isArray(rows) && rows[0]?.state_json) {
        const currentOwner = dbCache?.ownerAccount;
        dbCache = {
          ...getDefaultDbState(),
          ...rows[0].state_json,
          ownerAccount: rows[0].state_json.ownerAccount || currentOwner || null,
        };
        if (dbCache.ownerAccount) {
          supabaseInitialPullDone = true;
          return;
        }
      }
    }

    // 3. Fallback a public.profiles (ricostruisce ownerAccount se presente in tabella relazionale)
    const profRes = await supabaseSmartFetch(
      `${cfg.baseUrl}/rest/v1/profiles?select=*&order=created_at.asc&limit=1`,
      cfg.apiKey,
      { bearerToken: activeBearer, extraHeaders: { Accept: 'application/json' } }
    );
    if (profRes.ok) {
      const profiles = (await profRes.json()) as {
        id: string;
        email: string;
        display_name: string;
        onboarding_completed?: boolean;
        created_at?: string;
      }[];
      if (Array.isArray(profiles) && profiles[0]?.email) {
        const p = profiles[0];
        lastSupabaseDiagnostics.profileStatus = 'PRESENT_IN_PROFILES';
        lastSupabaseDiagnostics.authUserStatus = 'PRESENT_IN_AUTH_USERS';
        if (!dbCache) dbCache = getDefaultDbState();
        if (!dbCache.ownerAccount) {
          dbCache.ownerAccount = {
            passwordHash: 'SUPABASE_AUTH_MANAGED',
            user: {
              id: p.id,
              email: p.email,
              displayName: p.display_name || 'Investitore Proprietario',
              isOwner: true,
              onboardingCompleted: Boolean(p.onboarding_completed),
              uiMode: 'SIMPLE',
              theme: 'DARK',
              dataExecutionMode: 'LIVE',
              preferredCurrency: 'EUR',
              timezone: 'Europe/Rome',
              experienceLevel: 'INTERMEDIATE',
              riskTolerance: 'MODERATE',
              investmentGoals: ['CAPITAL_GROWTH', 'RISK_CONTROL'],
              preferredHorizons: ['BREVE', 'MEDIO', 'LUNGO'],
              preferredMarkets: ['CRYPTO', 'EQUITY', 'ETF'],
              selectedBrokers: ['TRADE_REPUBLIC', 'IBKR', 'AVATRADE', 'MT5'],
              quietHoursStart: '22:30',
              quietHoursEnd: '07:30',
              maxDailyNotifications: 15,
              createdAt: p.created_at || new Date().toISOString(),
            },
          };
        }
        supabaseInitialPullDone = true;
        return;
      }
    }

    // 4. Fallback a auth.users tramite service_role (se l'utente è in auth.users ma manca in public.profiles)
    if (cfg.serviceRoleKey) {
      const adminUsersRes = await supabaseSmartFetch(
        `${cfg.baseUrl}/auth/v1/admin/users`,
        cfg.serviceRoleKey
      );
      if (adminUsersRes.ok) {
        const data = (await adminUsersRes.json()) as {
          users?: {
            id: string;
            email?: string;
            user_metadata?: { display_name?: string };
            created_at?: string;
          }[];
        };
        const firstAuthUser = data.users?.[0];
        if (firstAuthUser?.email) {
          lastSupabaseDiagnostics.authUserStatus = 'PRESENT_IN_AUTH_USERS';
          if (!dbCache) dbCache = getDefaultDbState();
          if (!dbCache.ownerAccount) {
            dbCache.ownerAccount = {
              passwordHash: 'SUPABASE_AUTH_MANAGED',
              user: {
                id: firstAuthUser.id,
                email: firstAuthUser.email.toLowerCase(),
                displayName:
                  firstAuthUser.user_metadata?.display_name ||
                  firstAuthUser.email.split('@')[0] ||
                  'Investitore Proprietario',
                isOwner: true,
                onboardingCompleted: false,
                uiMode: 'SIMPLE',
                theme: 'DARK',
                dataExecutionMode: 'LIVE',
                preferredCurrency: 'EUR',
                timezone: 'Europe/Rome',
                experienceLevel: 'INTERMEDIATE',
                riskTolerance: 'MODERATE',
                investmentGoals: ['CAPITAL_GROWTH', 'RISK_CONTROL'],
                preferredHorizons: ['BREVE', 'MEDIO', 'LUNGO'],
                preferredMarkets: ['CRYPTO', 'EQUITY', 'ETF'],
                selectedBrokers: ['TRADE_REPUBLIC', 'IBKR', 'AVATRADE', 'MT5'],
                quietHoursStart: '22:30',
                quietHoursEnd: '07:30',
                maxDailyNotifications: 15,
                createdAt: firstAuthUser.created_at || new Date().toISOString(),
              },
            };
            await pushStateToSupabaseIfConfigured(dbCache);
          }
          supabaseInitialPullDone = true;
        }
      }
    }
  } catch (err) {
    lastSupabaseDiagnostics.connectionStatus = 'NETWORK_ERROR';
    lastSupabaseDiagnostics.lastError =
      err instanceof Error ? err.message : 'Errore di rete verso Supabase REST';
  }
}

export async function pushStateToSupabaseIfConfigured(
  stateToPush?: PersistedDatabaseState,
  options?: { plainPassword?: string }
): Promise<SupabaseSyncDiagnostics> {
  const cfg = getSupabaseConfig();
  const stepsLog: SupabaseSyncDiagnostics['syncStepsLog'] = [];
  const logStep = (step: string, status: 'OK' | 'WARN' | 'ERROR', detail: string) => {
    stepsLog.push({
      step,
      status,
      detail,
      timestamp: new Date().toISOString(),
    });
  };

  if (!cfg) {
    logStep(
      'Verifica Credenziali Supabase',
      'WARN',
      'Nessuna chiave API Supabase configurata nel runtime (configura SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_ANON_KEY).'
    );
    lastSupabaseDiagnostics.syncStepsLog = stepsLog;
    return getSupabaseDiagnosticsSnapshot();
  }

  const state = stateToPush || getDbState();
  const nowIso = new Date().toISOString();
  const upsertHeaders = {
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };

  try {
    let authUserId: string | null = null;
    let userAccessToken: string = cfg.serviceRoleKey || cachedSupabaseUserAccessToken || cfg.apiKey;

    // 1. PRIMA PRIORITÀ: Sincronizzazione immediata di Supabase Auth (auth.users)
    if (state.ownerAccount) {
      const owner = state.ownerAccount.user;
      // Normalizza eventuale dominio .local (rifiutato da GoTrue) in .com per compatibilità Auth
      const authEmail = owner.email.endsWith('.local')
        ? owner.email.replace(/\.local$/i, '.com')
        : owner.email;
      const passwordToUse =
        options?.plainPassword || `DemInvest!${state.ownerAccount.passwordHash.slice(0, 18)}`;

      if (cfg.serviceRoleKey) {
        const listUsersRes = await supabaseSmartFetch(
          `${cfg.baseUrl}/auth/v1/admin/users`,
          cfg.serviceRoleKey
        );
        if (listUsersRes.ok) {
          lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
          const listData = (await listUsersRes.json()) as {
            users?: { id: string; email?: string; email_confirmed_at?: string | null }[];
          };
          const found = listData.users?.find(
            (u) =>
              u.email?.toLowerCase() === owner.email.toLowerCase() ||
              u.email?.toLowerCase() === authEmail.toLowerCase()
          );
          if (found) {
            authUserId = found.id;
            lastSupabaseDiagnostics.authUserStatus = 'PRESENT_IN_AUTH_USERS';
            logStep(
              'Supabase Auth (auth.users)',
              'OK',
              `Utente proprietario ${found.email} presente in auth.users (ID: ${authUserId}).`
            );
            if (options?.plainPassword || !found.email_confirmed_at) {
              await supabaseSmartFetch(
                `${cfg.baseUrl}/auth/v1/admin/users/${authUserId}`,
                cfg.serviceRoleKey,
                {
                  method: 'PUT',
                  extraHeaders: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email_confirm: true,
                    ...(options?.plainPassword ? { password: options.plainPassword } : {}),
                    user_metadata: { display_name: owner.displayName, is_owner: true },
                  }),
                }
              );
            }
          }
        }

        if (!authUserId) {
          const createRes = await supabaseSmartFetch(
            `${cfg.baseUrl}/auth/v1/admin/users`,
            cfg.serviceRoleKey,
            {
              method: 'POST',
              extraHeaders: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: authEmail,
                password: passwordToUse,
                email_confirm: true,
                user_metadata: { display_name: owner.displayName, is_owner: true },
              }),
            }
          );
          if (createRes.ok) {
            lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
            const created = (await createRes.json()) as { id?: string };
            if (created.id) {
              authUserId = created.id;
              lastSupabaseDiagnostics.authUserStatus = 'PRESENT_IN_AUTH_USERS';
              logStep(
                'Supabase Auth (auth.users)',
                'OK',
                `Account proprietario ${authEmail} creato e confermato in auth.users.`
              );
            }
          } else {
            const errTxt = await createRes.text();
            logStep(
              'Supabase Auth (auth.users)',
              'WARN',
              `Creazione admin non completata (HTTP ${createRes.status}): ${errTxt.slice(0, 120)}`
            );
          }
        }
      } else {
        // Flusso con chiave pubblica (anon / publishable)
        const loginRes = await supabaseSmartFetch(
          `${cfg.baseUrl}/auth/v1/token?grant_type=password`,
          cfg.apiKey,
          {
            method: 'POST',
            extraHeaders: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: authEmail, password: passwordToUse }),
          }
        );
        if (loginRes.ok) {
          lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
          const data = (await loginRes.json()) as {
            access_token?: string;
            user?: { id?: string };
          };
          if (data.user?.id) authUserId = data.user.id;
          if (data.access_token) {
            userAccessToken = data.access_token;
            cachedSupabaseUserAccessToken = data.access_token;
          }
          lastSupabaseDiagnostics.authUserStatus = 'PRESENT_IN_AUTH_USERS';
          logStep(
            'Supabase Auth (Sign-In)',
            'OK',
            `Sessione autenticata per ${authEmail} su Supabase Auth.`
          );
        } else {
          const loginErrText = await loginRes.text();
          if (loginErrText.includes('Email not confirmed') || loginErrText.includes('email_not_confirmed')) {
            lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
            lastSupabaseDiagnostics.authUserStatus = 'EMAIL_UNCONFIRMED';
            logStep(
              'Supabase Auth (Sign-In)',
              'WARN',
              `Utente ${authEmail} già presente in auth.users (in attesa di conferma email o chiave Service Role).`
            );
          } else {
            const signupRes = await supabaseSmartFetch(
              `${cfg.baseUrl}/auth/v1/signup`,
              cfg.apiKey,
              {
                method: 'POST',
                extraHeaders: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: authEmail,
                  password: passwordToUse,
                  data: { display_name: owner.displayName, is_owner: true },
                }),
              }
            );
            if (signupRes.ok) {
              lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
              const sData = (await signupRes.json()) as {
                id?: string;
                access_token?: string;
                user?: { id?: string };
              };
              authUserId = sData.user?.id || sData.id || null;
              if (sData.access_token) {
                userAccessToken = sData.access_token;
                cachedSupabaseUserAccessToken = sData.access_token;
                lastSupabaseDiagnostics.authUserStatus = 'PRESENT_IN_AUTH_USERS';
                logStep(
                  'Supabase Auth (Sign-Up)',
                  'OK',
                  `Utente ${authEmail} registrato e autenticato in auth.users.`
                );
              } else {
                lastSupabaseDiagnostics.authUserStatus = 'EMAIL_UNCONFIRMED';
                logStep(
                  'Supabase Auth (Sign-Up)',
                  'OK',
                  `Utente ${authEmail} creato in auth.users (ID: ${authUserId || 'generato'}).`
                );
              }
            } else {
              const sErr = await signupRes.text();
              if (sErr.includes('already registered') || sErr.includes('user_already_exists')) {
                lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
                lastSupabaseDiagnostics.authUserStatus = 'PRESENT_IN_AUTH_USERS';
                logStep(
                  'Supabase Auth (auth.users)',
                  'OK',
                  `Utente ${authEmail} già registrato in auth.users.`
                );
              } else {
                logStep(
                  'Supabase Auth (Sign-Up)',
                  'WARN',
                  `Risposta Auth HTTP ${signupRes.status}: ${sErr.slice(0, 120)}`
                );
              }
            }
          }
        }
      }
    }

    // 2. Salva in public.application_settings
    const appSettingsRes = await supabaseSmartFetch(
      `${cfg.baseUrl}/rest/v1/application_settings`,
      cfg.apiKey,
      {
        method: 'POST',
        bearerToken: userAccessToken,
        extraHeaders: upsertHeaders,
        body: JSON.stringify({
          key: 'DEMINVEST_RUNTIME_STATE',
          value: state,
          description:
            'Stato completo sincronizzato DemInvest Cloud (Owner, Portafoglio, Segnali, Alert)',
          updated_at: nowIso,
        }),
      }
    );

    if (appSettingsRes.ok) {
      lastSupabaseDiagnostics.connectionStatus = 'CONNECTED';
      lastSupabaseDiagnostics.lastError = null;
      logStep(
        'application_settings (DEMINVEST_RUNTIME_STATE)',
        'OK',
        `Stato applicativo primario salvato correttamente (HTTP ${appSettingsRes.status}).`
      );
    } else {
      const errText = await appSettingsRes.text();
      if (appSettingsRes.status === 401 || appSettingsRes.status === 403) {
        if (lastSupabaseDiagnostics.connectionStatus !== 'CONNECTED') {
          lastSupabaseDiagnostics.connectionStatus = 'AUTH_ERROR';
        }
      } else if (appSettingsRes.status === 404) {
        lastSupabaseDiagnostics.connectionStatus = 'SCHEMA_INCOMPLETE';
      }
      logStep(
        'application_settings (DEMINVEST_RUNTIME_STATE)',
        'WARN',
        `HTTP ${appSettingsRes.status}: ${errText.slice(0, 140)}`
      );
    }

    // 3. Salva anche in public.app_state_store (se presente)
    const appStoreRes = await supabaseSmartFetch(
      `${cfg.baseUrl}/rest/v1/app_state_store`,
      cfg.apiKey,
      {
        method: 'POST',
        bearerToken: userAccessToken,
        extraHeaders: upsertHeaders,
        body: JSON.stringify({
          id: 'deminvest_primary_state',
          state_json: state,
          updated_at: nowIso,
        }),
      }
    );
    if (appStoreRes.ok) {
      logStep('app_state_store', 'OK', 'Snapshot JSON sincronizzato.');
    }

    // 4. Popola i cataloghi relazionali (market_data_providers, trading_venues, assets, instruments)
    await supabaseSmartFetch(`${cfg.baseUrl}/rest/v1/market_data_providers`, cfg.apiKey, {
      method: 'POST',
      bearerToken: userAccessToken,
      extraHeaders: upsertHeaders,
      body: JSON.stringify([
        {
          id: 'coingecko',
          display_name: 'CoinGecko API v3',
          status: 'OPERATIONAL',
          has_credentials: true,
          supports_realtime: true,
          supported_asset_classes: ['CRYPTO'],
        },
        {
          id: 'twelvedata',
          display_name: 'Twelve Data API',
          status: 'OPERATIONAL_SANDBOX',
          has_credentials: false,
          supports_realtime: true,
          supported_asset_classes: ['EQUITY', 'ETF', 'FOREX'],
        },
        {
          id: 'alphavantage',
          display_name: 'Alpha Vantage API',
          status: 'OPERATIONAL_SANDBOX',
          has_credentials: false,
          supports_realtime: false,
          supported_asset_classes: ['EQUITY', 'ETF'],
        },
        {
          id: 'ecb_frankfurter',
          display_name: 'BCE Frankfurter FX',
          status: 'OPERATIONAL',
          has_credentials: true,
          supports_realtime: false,
          supported_asset_classes: ['FOREX'],
        },
        {
          id: 'fred',
          display_name: 'FRED St. Louis Fed',
          status: 'CONFIGURED',
          has_credentials: false,
          supports_realtime: false,
          supported_asset_classes: ['BOND', 'INDEX'],
        },
      ]),
    });

    await supabaseSmartFetch(`${cfg.baseUrl}/rest/v1/trading_venues`, cfg.apiKey, {
      method: 'POST',
      bearerToken: userAccessToken,
      extraHeaders: upsertHeaders,
      body: JSON.stringify([
        {
          mic_code: 'CRYPTO_GLOBAL',
          name: 'Mercato Globale Spot Crypto 24/7',
          country_code: 'GL',
          timezone: 'UTC',
          currency: 'USD',
          open_time: '00:00',
          close_time: '23:59',
          is_24_7: true,
        },
        {
          mic_code: 'XNGS',
          name: 'NASDAQ Global Select Market',
          country_code: 'US',
          timezone: 'America/New_York',
          currency: 'USD',
          open_time: '09:30',
          close_time: '16:00',
          is_24_7: false,
        },
        {
          mic_code: 'XNYS',
          name: 'New York Stock Exchange (NYSE)',
          country_code: 'US',
          timezone: 'America/New_York',
          currency: 'USD',
          open_time: '09:30',
          close_time: '16:00',
          is_24_7: false,
        },
        {
          mic_code: 'XETR',
          name: 'Deutsche Börse Xetra',
          country_code: 'DE',
          timezone: 'Europe/Berlin',
          currency: 'EUR',
          open_time: '09:00',
          close_time: '17:30',
          is_24_7: false,
        },
        {
          mic_code: 'FX_INTERBANK',
          name: 'Mercato Interbancario Forex',
          country_code: 'GL',
          timezone: 'UTC',
          currency: 'USD',
          open_time: '00:00',
          close_time: '23:59',
          is_24_7: false,
        },
      ]),
    });

    const assetsRes = await supabaseSmartFetch(`${cfg.baseUrl}/rest/v1/assets`, cfg.apiKey, {
      method: 'POST',
      bearerToken: userAccessToken,
      extraHeaders: upsertHeaders,
      body: JSON.stringify(
        state.assets.map((a) => ({
          id: a.id,
          canonical_symbol: a.canonicalSymbol,
          name: a.name,
          asset_class: a.assetClass,
          isin: a.isin || null,
          coingecko_id: a.coingeckoId || null,
          issuer_name: a.issuerName || null,
          blockchain: a.blockchain || null,
          network: a.network || null,
          contract_address: a.contractAddress || null,
          decimals: a.decimals ?? null,
          base_currency: a.baseCurrency,
          sector: a.sector || null,
          country: a.country || null,
          description: a.description || null,
        }))
      ),
    });

    const instRes = await supabaseSmartFetch(`${cfg.baseUrl}/rest/v1/instruments`, cfg.apiKey, {
      method: 'POST',
      bearerToken: userAccessToken,
      extraHeaders: upsertHeaders,
      body: JSON.stringify(
        state.instruments.map((inst) => ({
          id: inst.id,
          underlying_asset_id: inst.underlyingAssetId,
          instrument_type: inst.instrumentType,
          ticker: inst.ticker,
          venue_mic: ['CRYPTO_GLOBAL', 'XNGS', 'XNYS', 'XETR', 'FX_INTERBANK'].includes(
            inst.venueMic
          )
            ? inst.venueMic
            : null,
          quote_currency: inst.quoteCurrency,
          base_asset_symbol: inst.baseAssetSymbol || null,
          quote_asset_symbol: inst.quoteAssetSymbol || null,
          is_derivative: inst.isDerivative,
          primary_provider_id: inst.primaryProviderId,
          provider_symbol: inst.providerSymbol,
          secondary_provider_symbol: inst.secondaryProviderSymbol || null,
        }))
      ),
    });

    if (assetsRes.ok && instRes.ok) {
      logStep(
        'Catalogo Mercati (assets & instruments)',
        'OK',
        `${state.assets.length} asset e ${state.instruments.length} strumenti sincronizzati.`
      );
    }

    // 5. Sincronizzazione tabelle profilo proprietario (profiles, user_preferences, watchlists, portfolios)
    if (state.ownerAccount) {
      const owner = state.ownerAccount.user;
      if (authUserId) {
        // Aggiorna l'ID locale dell'owner con il vero UUID di Supabase Auth
        state.ownerAccount.user.id = authUserId;

        // 4A. Riconciliazione public.profiles
        const checkProf = await supabaseSmartFetch(
          `${cfg.baseUrl}/rest/v1/profiles?id=eq.${authUserId}&select=id`,
          cfg.apiKey,
          { bearerToken: userAccessToken }
        );
        const existingRows = checkProf.ok ? ((await checkProf.json()) as { id: string }[]) : [];

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          const patchRes = await supabaseSmartFetch(
            `${cfg.baseUrl}/rest/v1/profiles?id=eq.${authUserId}`,
            cfg.apiKey,
            {
              method: 'PATCH',
              bearerToken: userAccessToken,
              extraHeaders: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                display_name: owner.displayName,
                onboarding_completed: owner.onboardingCompleted,
                updated_at: nowIso,
              }),
            }
          );
          if (patchRes.ok) {
            lastSupabaseDiagnostics.profileStatus = 'PRESENT_IN_PROFILES';
            logStep('Tabella public.profiles', 'OK', 'Profilo proprietario aggiornato.');
          }
        } else {
          const postProfRes = await supabaseSmartFetch(
            `${cfg.baseUrl}/rest/v1/profiles`,
            cfg.apiKey,
            {
              method: 'POST',
              bearerToken: userAccessToken,
              extraHeaders: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: authUserId,
                email: owner.email,
                display_name: owner.displayName,
                is_owner: true,
                onboarding_completed: owner.onboardingCompleted,
                updated_at: nowIso,
              }),
            }
          );
          if (postProfRes.ok) {
            lastSupabaseDiagnostics.profileStatus = 'RECONCILED';
            logStep(
              'Tabella public.profiles',
              'OK',
              `Profilo proprietario creato e riconciliato per ${owner.email}.`
            );
          } else {
            const pErr = await postProfRes.text();
            lastSupabaseDiagnostics.profileStatus = 'MISSING_IN_PROFILES';
            logStep(
              'Tabella public.profiles',
              'ERROR',
              `Impossibile creare riga in profiles (HTTP ${postProfRes.status}): ${pErr.slice(0, 140)}`
            );
          }
        }

        // 4B. Riconciliazione public.user_preferences
        const prefRes = await supabaseSmartFetch(
          `${cfg.baseUrl}/rest/v1/user_preferences`,
          cfg.apiKey,
          {
            method: 'POST',
            bearerToken: userAccessToken,
            extraHeaders: upsertHeaders,
            body: JSON.stringify({
              user_id: authUserId,
              ui_mode: owner.uiMode,
              theme: owner.theme,
              preferred_currency: owner.preferredCurrency,
              timezone: owner.timezone,
              experience_level: owner.experienceLevel,
              risk_tolerance: owner.riskTolerance,
              investment_goals: owner.investmentGoals,
              preferred_horizons: owner.preferredHorizons,
              preferred_markets: owner.preferredMarkets,
              quiet_hours_start: owner.quietHoursStart,
              quiet_hours_end: owner.quietHoursEnd,
              max_daily_notifications: owner.maxDailyNotifications,
              updated_at: nowIso,
            }),
          }
        );
        if (prefRes.ok) {
          logStep('Tabella public.user_preferences', 'OK', 'Preferenze utente sincronizzate.');
        }

        // 4C. Riconciliazione public.user_brokers
        if (owner.selectedBrokers.length > 0) {
          await supabaseSmartFetch(
            `${cfg.baseUrl}/rest/v1/user_brokers?on_conflict=user_id,broker_code`,
            cfg.apiKey,
            {
              method: 'POST',
              bearerToken: userAccessToken,
              extraHeaders: upsertHeaders,
              body: JSON.stringify(
                owner.selectedBrokers.map((code) => ({
                  user_id: authUserId,
                  broker_code: code,
                  broker_name: code.replace('_', ' '),
                  platform_type: code === 'MT4' || code === 'MT5' ? 'TERMINAL' : 'BROKER',
                  default_currency: owner.preferredCurrency,
                  is_active: true,
                }))
              ),
            }
          );
        }

        // 4D. Riconciliazione public.watchlists & watchlist_items
        const wlCheck = await supabaseSmartFetch(
          `${cfg.baseUrl}/rest/v1/watchlists?user_id=eq.${authUserId}&select=id&limit=1`,
          cfg.apiKey,
          { bearerToken: userAccessToken }
        );
        let watchlistId: string | null = null;
        if (wlCheck.ok) {
          const wlRows = (await wlCheck.json()) as { id: string }[];
          if (wlRows[0]?.id) watchlistId = wlRows[0].id;
        }
        if (!watchlistId) {
          const createWl = await supabaseSmartFetch(
            `${cfg.baseUrl}/rest/v1/watchlists`,
            cfg.apiKey,
            {
              method: 'POST',
              bearerToken: userAccessToken,
              extraHeaders: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                user_id: authUserId,
                name: 'Watchlist Principale',
                is_default: true,
              }),
            }
          );
          if (createWl.ok) {
            const createdWl = (await createWl.json()) as { id: string }[];
            if (createdWl[0]?.id) watchlistId = createdWl[0].id;
          }
        }
        if (watchlistId && state.watchlistInstrumentIds.length > 0) {
          const wlItemsRes = await supabaseSmartFetch(
            `${cfg.baseUrl}/rest/v1/watchlist_items?on_conflict=watchlist_id,instrument_id`,
            cfg.apiKey,
            {
              method: 'POST',
              bearerToken: userAccessToken,
              extraHeaders: upsertHeaders,
              body: JSON.stringify(
                state.watchlistInstrumentIds.map((instId, idx) => ({
                  watchlist_id: watchlistId,
                  instrument_id: instId,
                  preferred_horizon: 'BREVE',
                  preferred_broker_code: owner.selectedBrokers[0] || 'TRADE_REPUBLIC',
                  notes: `Strumento monitorato #${idx + 1}`,
                }))
              ),
            }
          );
          if (wlItemsRes.ok) {
            logStep(
              'Tabelle public.watchlists & watchlist_items',
              'OK',
              `${state.watchlistInstrumentIds.length} strumenti salvati nella watchlist su Supabase.`
            );
          }
        }

        // 4E. Riconciliazione public.portfolios & portfolio_transactions
        const pfCheck = await supabaseSmartFetch(
          `${cfg.baseUrl}/rest/v1/portfolios?user_id=eq.${authUserId}&select=id&limit=1`,
          cfg.apiKey,
          { bearerToken: userAccessToken }
        );
        let portfolioId: string | null = null;
        if (pfCheck.ok) {
          const pfRows = (await pfCheck.json()) as { id: string }[];
          if (pfRows[0]?.id) portfolioId = pfRows[0].id;
        }
        if (!portfolioId) {
          const createPf = await supabaseSmartFetch(
            `${cfg.baseUrl}/rest/v1/portfolios`,
            cfg.apiKey,
            {
              method: 'POST',
              bearerToken: userAccessToken,
              extraHeaders: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                user_id: authUserId,
                name: 'Portafoglio Personale DemInvest',
                base_currency: owner.preferredCurrency,
                cash_balance: 15000,
              }),
            }
          );
          if (createPf.ok) {
            const createdPf = (await createPf.json()) as { id: string }[];
            if (createdPf[0]?.id) portfolioId = createdPf[0].id;
          }
        }
        if (portfolioId) {
          logStep('Tabella public.portfolios', 'OK', `Portafoglio attivo (ID: ${portfolioId}).`);
          // Sincronizza le transazioni di portafoglio se la tabella relazionale è vuota
          const txCheck = await supabaseSmartFetch(
            `${cfg.baseUrl}/rest/v1/portfolio_transactions?portfolio_id=eq.${portfolioId}&select=id`,
            cfg.apiKey,
            { bearerToken: userAccessToken }
          );
          const existingTx = txCheck.ok ? ((await txCheck.json()) as { id: string }[]) : [];
          if (
            Array.isArray(existingTx) &&
            existingTx.length < state.portfolioTransactions.length
          ) {
            const missingCount = state.portfolioTransactions.length - existingTx.length;
            const toInsert = state.portfolioTransactions.slice(0, missingCount).map((tx) => ({
              portfolio_id: portfolioId,
              instrument_id: tx.instrumentId || null,
              transaction_type: tx.transactionType,
              quantity: tx.quantity,
              unit_price: tx.unitPrice,
              fees: tx.fees,
              currency: tx.currency,
              fx_rate_to_base: tx.fxRateToBase,
              fx_source: tx.fxSource,
              fx_observed_at: tx.fxObservedAt,
              declared_broker_code: tx.declaredBrokerCode || null,
              executed_at: tx.executedAt,
              notes: tx.notes || null,
            }));
            await supabaseSmartFetch(`${cfg.baseUrl}/rest/v1/portfolio_transactions`, cfg.apiKey, {
              method: 'POST',
              bearerToken: userAccessToken,
              extraHeaders: { 'Content-Type': 'application/json' },
              body: JSON.stringify(toInsert),
            });
          }
        }

        // 4F. Riconciliazione public.alert_rules
        const arCheck = await supabaseSmartFetch(
          `${cfg.baseUrl}/rest/v1/alert_rules?user_id=eq.${authUserId}&select=id`,
          cfg.apiKey,
          { bearerToken: userAccessToken }
        );
        const existingAr = arCheck.ok ? ((await arCheck.json()) as { id: string }[]) : [];
        if (Array.isArray(existingAr) && existingAr.length < state.alertRules.length) {
          const missingAlerts = state.alertRules.slice(0, state.alertRules.length - existingAr.length);
          await supabaseSmartFetch(`${cfg.baseUrl}/rest/v1/alert_rules`, cfg.apiKey, {
            method: 'POST',
            bearerToken: userAccessToken,
            extraHeaders: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              missingAlerts.map((r) => ({
                user_id: authUserId,
                instrument_id: r.instrumentId,
                broker_code: r.brokerCode || null,
                rule_type: r.ruleType,
                horizon: r.horizon,
                threshold_value: r.thresholdValue,
                priority: r.priority,
                cooldown_minutes: r.cooldownMinutes,
                is_active: r.isActive,
              }))
            ),
          });
        }

        // 4G. Riconciliazione public.paper_accounts
        const paCheck = await supabaseSmartFetch(
          `${cfg.baseUrl}/rest/v1/paper_accounts?user_id=eq.${authUserId}&select=id&limit=1`,
          cfg.apiKey,
          { bearerToken: userAccessToken }
        );
        if (paCheck.ok) {
          const paRows = (await paCheck.json()) as { id: string }[];
          if (!paRows[0]?.id) {
            await supabaseSmartFetch(`${cfg.baseUrl}/rest/v1/paper_accounts`, cfg.apiKey, {
              method: 'POST',
              bearerToken: userAccessToken,
              extraHeaders: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: authUserId,
                name: state.paperAccount.name,
                base_currency: state.paperAccount.baseCurrency,
                initial_capital: state.paperAccount.initialCapital,
                cash_balance: state.paperAccount.cashBalance,
              }),
            });
          }
        }
      }
    }

    // 5. Lettura conteggi righe reali su Supabase per diagnostica verificabile
    const activeCountBearer =
      cfg.serviceRoleKey || cachedSupabaseUserAccessToken || cfg.apiKey;
    const countTable = async (table: string): Promise<number> => {
      const r = await supabaseSmartFetch(
        `${cfg.baseUrl}/rest/v1/${table}?select=*`,
        cfg.apiKey,
        { bearerToken: activeCountBearer, extraHeaders: { Prefer: 'count=exact' } }
      );
      if (!r.ok) return 0;
      const rows = (await r.json()) as unknown[];
      return Array.isArray(rows) ? rows.length : 0;
    };

    const [
      cProfiles,
      cPrefs,
      cWatchlists,
      cPortfolios,
      cTx,
      cAlerts,
      cInstruments,
      cSettings,
    ] = await Promise.all([
      countTable('profiles'),
      countTable('user_preferences'),
      countTable('watchlists'),
      countTable('portfolios'),
      countTable('portfolio_transactions'),
      countTable('alert_rules'),
      countTable('instruments'),
      countTable('application_settings'),
    ]);

    lastSupabaseDiagnostics.remoteTableCounts = {
      profiles: cProfiles,
      user_preferences: cPrefs,
      watchlists: cWatchlists,
      portfolios: cPortfolios,
      portfolio_transactions: cTx,
      alert_rules: cAlerts,
      instruments: cInstruments,
      application_settings: cSettings,
    };
    lastSupabaseDiagnostics.lastSyncAt = nowIso;
    lastSupabaseDiagnostics.syncStepsLog = stepsLog;
  } catch (err) {
    lastSupabaseDiagnostics.connectionStatus = 'NETWORK_ERROR';
    lastSupabaseDiagnostics.lastError =
      err instanceof Error ? err.message : 'Errore di rete durante la sincronizzazione Supabase';
    logStep('Eccezione Rete Supabase', 'ERROR', lastSupabaseDiagnostics.lastError);
    lastSupabaseDiagnostics.syncStepsLog = stepsLog;
  }

  return getSupabaseDiagnosticsSnapshot();
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

  // Tool 6 (Prompt 3): detect_market_regime & Multi-Timeframe
  const t5 = Date.now();
  const dataQuality = auditMarketDataQuality(targetInstrument.id, '1d', candles, quote, {
    isDerivative: targetInstrument.isDerivative,
    assetClass: targetInstrument.assetClass,
  });
  const regime = detectMarketRegime(indicators);
  const multiTimeframe = evaluateMultiTimeframeConsensus(
    targetInstrument.id,
    params.activeHorizon,
    indicators,
    null
  );
  toolCalls.push({
    id: `TOOL_${Date.now()}_REGIME`,
    toolName: 'detect_market_regime',
    inputParams: { instrumentId: targetInstrument.id, horizon: params.activeHorizon },
    outputSummary: {
      dataQuality: dataQuality.classification,
      directionalRegime: regime.directionalRegime,
      volatilityRegime: regime.volatilityRegime,
      multiTimeframeConsensus: multiTimeframe.consensusState,
      compatibleStrategies: regime.compatibleStrategies,
    },
    executionMs: Math.max(1, Date.now() - t5),
    status: 'SUCCESS',
    executedAt: new Date().toISOString(),
  });

  // Tool 7 (Prompt 3): evaluate_strategy_setup & assess_signal_risk
  const t6 = Date.now();
  const holdsPos = portfolioSummary.positions.some((p) => p.instrumentId === targetInstrument.id);
  const strategiesV3 = evaluateAllStrategiesForInstrument({
    instrument: targetInstrument,
    quote,
    dataQuality,
    indicators,
    regime,
    multiTimeframe,
    horizon: params.activeHorizon,
    holdsPositionInPortfolio: holdsPos,
  });
  const bestStrategyV3 = [...strategiesV3].sort(
    (a, b) => (b.isTriggered ? 100 : 0) + b.heuristicScore - ((a.isTriggered ? 100 : 0) + a.heuristicScore)
  )[0];
  const riskReportV3 = evaluateRiskIntelligence({
    instrument: targetInstrument,
    quote,
    indicators,
    bestSetup: bestStrategyV3,
    baseCurrency: 'EUR',
  });
  toolCalls.push({
    id: `TOOL_${Date.now()}_STRAT_RISK`,
    toolName: 'evaluate_strategy_setup',
    inputParams: { instrumentId: targetInstrument.id, horizon: params.activeHorizon },
    outputSummary: {
      bestStrategyId: bestStrategyV3.strategyId,
      isTriggered: bestStrategyV3.isTriggered,
      signalClassification: bestStrategyV3.signalClassification,
      sellDistinction: bestStrategyV3.sellDistinction,
      invalidationPrice: bestStrategyV3.invalidationPrice,
      riskBand: riskReportV3.riskBand,
      overallRiskScore: riskReportV3.overallRiskScore,
    },
    executionMs: Math.max(1, Date.now() - t6),
    status: 'SUCCESS',
    executedAt: new Date().toISOString(),
  });

  // Registra tutti i tool log
  db.aiToolLogs = [...toolCalls, ...db.aiToolLogs].slice(0, 150);

  // Costruzione delle 5 sezioni obbligatorie anti-allucinazione (Sezione 13 & Prompt 3 Sezione 14)
  const verifiedData: string[] = [];
  if (quote.validity === 'VALID') {
    verifiedData.push(
      `Strumento selezionato: ${targetInstrument.name} (${targetInstrument.ticker}) — Tipo: ${targetInstrument.instrumentType} su ${targetInstrument.venueName} (MIC: ${targetInstrument.venueMic}).`
    );
    verifiedData.push(
      `Quotazione verificata: ${quote.price} ${quote.currency} (Variazione 24h: ${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%) | Fonte: ${quote.providerName} | Rilevato: ${quote.observedAt} | Stato freschezza: ${quote.freshness} | Audit Qualità Dati: ${dataQuality.classification}.`
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
      `Regime di Mercato Rilevato: ${regime.explanation}`
    );
    quantitativeCalculations.push(
      `Consenso Multi-Timeframe: ${multiTimeframe.summary}`
    );
    quantitativeCalculations.push(
      `Trend (su ${indicators.observationsCount} candele chiuse): Direzione ${indicators.trendDirection} | SMA(20) = ${indicators.sma20 ?? 'N/D'} | SMA(50) = ${indicators.sma50 ?? 'N/D'} | EMA(20) = ${indicators.ema20 ?? 'N/D'} | EMA(50) = ${indicators.ema50 ?? 'N/D'} | ADX(14) = ${indicators.adx14 ?? 'N/D'}.`
    );
    quantitativeCalculations.push(
      `Momentum: RSI(14) = ${indicators.rsi14 ?? 'N/D'} | MACD Histogram = ${indicators.macd?.histogram ?? 'N/D'} | ROC(10) = ${indicators.roc10 !== null ? indicators.roc10 + '%' : 'N/D'}.`
    );
    quantitativeCalculations.push(
      `Volatilità e Rischio: Fascia Rischio = ${riskReportV3.riskBand} (Score ${riskReportV3.overallRiskScore}/100) | ATR(14) = ${indicators.atr14 ?? 'N/D'} (${indicators.atrPct ?? 'N/D'}% del prezzo) | Volatilità Annualizzata = ${indicators.historicalVolatilityAnnualizedPct !== null ? indicators.historicalVolatilityAnnualizedPct + '%' : 'N/D'} | Max Drawdown = ${indicators.maxDrawdownPct !== null ? indicators.maxDrawdownPct + '%' : 'N/D'}.`
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
    technicalInterpretations.push(
      `Strategia Primaria (${bestStrategyV3.strategyName} v${bestStrategyV3.strategyVersion}): Classificazione ${bestStrategyV3.signalClassification} (Stato: ${bestStrategyV3.signalStatus}) — Punteggio euristico: ${bestStrategyV3.heuristicScore}/100 (non è una probabilità di profitto).`
    );
    technicalInterpretations.push(bestStrategyV3.rationale);
    if (bestStrategyV3.invalidationPrice !== null) {
      technicalInterpretations.push(
        `Livello di Invalidazione Tecnico: ${bestStrategyV3.invalidationPrice} ${quote.currency} (${bestStrategyV3.invalidationReason}).`
      );
    }
    if (bestStrategyV3.conditionsUnmet.length > 0) {
      technicalInterpretations.push(
        `Condizioni non soddisfatte / da monitorare: ${bestStrategyV3.conditionsUnmet.join(' | ')}`
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

// ------------------------------------------------------------------------------
// MARKET INTELLIGENCE V3 ORCHESTRATORS (SCANNER, SINGLE ANALYSIS, SIMULATOR)
// ------------------------------------------------------------------------------

export async function analyzeBackendInstrumentIntelligence(params: {
  instrumentId: string;
  horizon?: TimeHorizon;
  timeframe?: CandleTimeframe;
  mode?: DataExecutionMode;
}): Promise<AnalyzedInstrumentIntelligenceItem | null> {
  const db = getDbState();
  const mode = params.mode || db.ownerAccount?.user.dataExecutionMode || 'LIVE';
  const horizon = params.horizon || 'BREVE';
  const profile = HORIZON_PROFILES_V3[horizon];
  const timeframe = params.timeframe || profile.primaryTimeframe;

  const instrument = db.instruments.find((i) => i.id === params.instrumentId);
  if (!instrument) return null;

  const quote = await getMarketQuoteForInstrument(instrument.id, mode);
  const rawCandles = await getHistoricalCandlesForInstrument(instrument.id, timeframe, mode);
  const higherCandles =
    profile.higherConfirmationTimeframe !== timeframe
      ? await getHistoricalCandlesForInstrument(
          instrument.id,
          profile.higherConfirmationTimeframe,
          mode
        )
      : rawCandles;

  const dataQuality = auditMarketDataQuality(instrument.id, timeframe, rawCandles, quote, {
    isDerivative: instrument.isDerivative,
    assetClass: instrument.assetClass,
    minRequiredCandles: 15,
  });

  const annualization = instrument.assetClass === 'CRYPTO' ? 'CRYPTO' : 'OTHER';
  const indicators = computeQuantitativeSnapshot(
    instrument.id,
    timeframe,
    rawCandles,
    annualization
  );
  const higherIndicators = computeQuantitativeSnapshot(
    instrument.id,
    profile.higherConfirmationTimeframe,
    higherCandles,
    annualization
  );

  const regime = detectMarketRegime(indicators);
  const multiTimeframe = evaluateMultiTimeframeConsensus(
    instrument.id,
    horizon,
    indicators,
    higherIndicators
  );

  const holdsInPortfolio = db.portfolioTransactions.some(
    (tx) => tx.instrumentId === instrument.id && tx.transactionType === 'BUY'
  );

  const strategiesEvaluated = evaluateAllStrategiesForInstrument({
    instrument,
    quote,
    dataQuality,
    indicators,
    regime,
    multiTimeframe,
    horizon,
    holdsPositionInPortfolio: holdsInPortfolio,
  });

  const sortedStrategies = [...strategiesEvaluated].sort(
    (a, b) =>
      (b.isTriggered ? 100 : 0) +
      b.heuristicScore -
      ((a.isTriggered ? 100 : 0) + a.heuristicScore)
  );
  const bestStrategySetup = sortedStrategies[0];

  const riskReport = evaluateRiskIntelligence({
    instrument,
    quote,
    indicators,
    bestSetup: bestStrategySetup,
    baseCurrency: db.ownerAccount?.user.preferredCurrency || 'EUR',
  });

  const priorityTier: AnalyzedInstrumentIntelligenceItem['priorityTier'] = holdsInPortfolio
    ? 'PORTFOLIO'
    : db.alertRules.some((r) => r.instrumentId === instrument.id && r.isActive)
      ? 'ACTIVE_ALERTS'
      : db.watchlistInstrumentIds.includes(instrument.id)
        ? 'WATCHLIST'
        : 'CATALOG';

  return {
    instrumentId: instrument.id,
    ticker: instrument.ticker,
    name: instrument.name,
    assetClass: instrument.assetClass,
    venueMic: instrument.venueMic,
    currency: instrument.quoteCurrency,
    priorityTier,
    quote,
    dataQuality,
    indicators,
    regime,
    multiTimeframe,
    strategiesEvaluated,
    bestStrategySetup,
    riskReport,
  };
}

export async function executeBackendSmartMarketScan(params: {
  filters?: MarketScanFilterParams;
  mode?: DataExecutionMode;
}): Promise<MarketScanRunResult> {
  const db = getDbState();
  const mode = params.mode || db.ownerAccount?.user.dataExecutionMode || 'LIVE';
  const filters = params.filters || {};
  const horizon: TimeHorizon = filters.horizon || 'BREVE';
  const profile = HORIZON_PROFILES_V3[horizon];
  const timeframe: CandleTimeframe = filters.timeframe || profile.primaryTimeframe;

  const quotesMap: Record<string, MarketQuote> = {};
  const candlesByInstrument: Record<string, HistoricalCandle[]> = {};
  const higherTfCandlesByInstrument: Record<string, HistoricalCandle[]> = {};

  for (const inst of db.instruments) {
    quotesMap[inst.id] = await getMarketQuoteForInstrument(inst.id, mode);
    candlesByInstrument[inst.id] = await getHistoricalCandlesForInstrument(
      inst.id,
      timeframe,
      mode
    );
    if (profile.higherConfirmationTimeframe !== timeframe) {
      higherTfCandlesByInstrument[inst.id] = await getHistoricalCandlesForInstrument(
        inst.id,
        profile.higherConfirmationTimeframe,
        mode
      );
    } else {
      higherTfCandlesByInstrument[inst.id] = candlesByInstrument[inst.id];
    }
  }

  const brokerSymbolMap: Record<string, string> = {};
  const instrumentBrokersMap: Record<string, string[]> = {};
  for (const bm of db.brokerMappings) {
    if (!instrumentBrokersMap[bm.instrumentId]) {
      instrumentBrokersMap[bm.instrumentId] = [];
    }
    instrumentBrokersMap[bm.instrumentId].push(bm.brokerCode);
    if (bm.verificationStatus !== 'UNVERIFIED' && !brokerSymbolMap[bm.instrumentId]) {
      brokerSymbolMap[bm.instrumentId] = `${bm.brokerCode}: ${bm.brokerSymbol}`;
    }
  }

  const portfolioInstrumentIds = Array.from(
    new Set(
      db.portfolioTransactions
        .filter((tx) => tx.instrumentId && tx.transactionType === 'BUY')
        .map((tx) => tx.instrumentId as string)
    )
  );

  const activeAlertInstrumentIds = Array.from(
    new Set(db.alertRules.filter((r) => r.isActive).map((r) => r.instrumentId))
  );

  return runSmartMarketScanner({
    instruments: db.instruments,
    quotesMap,
    candlesByInstrument,
    higherTfCandlesByInstrument,
    watchlistIds: db.watchlistInstrumentIds,
    activeAlertInstrumentIds,
    portfolioInstrumentIds,
    brokerSymbolMap,
    instrumentBrokersMap,
    filters,
    mode,
    baseCurrency: db.ownerAccount?.user.preferredCurrency || 'EUR',
  });
}

export function runBackendPositionSimulation(
  input: PositionSimulationInput
): PositionSimulationResult {
  return simulatePositionRisk(input);
}

export function getQuantitativeStrategiesCatalogV3() {
  return {
    strategies: QUANTITATIVE_STRATEGIES_V3,
    horizonProfiles: HORIZON_PROFILES_V3,
  };
}

