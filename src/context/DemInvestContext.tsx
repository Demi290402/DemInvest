import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AIChatMessage,
  AIToolCallLog,
  AlertRule,
  BrokerInstrumentMapping,
  DataExecutionMode,
  GeneratedSignal,
  MarketQuote,
  MarketScanFilterParams,
  MarketScanRunResult,
  NegotiableInstrument,
  NotificationItem,
  PaperAccountState,
  PortfolioAnalyticsSummary,
  PortfolioTransaction,
  PositionSimulationInput,
  PositionSimulationResult,
  ProviderHealthInfo,
  SchedulerStatusInfo,
  SupabaseSyncDiagnostics,
  ThemeMode,
  TimeHorizon,
  UIMode,
  UnderlyingAsset,
  UserProfileAndPreferences,
} from '../types/domain';
import {
  INITIAL_BROKER_MAPPINGS,
  INITIAL_NEGOTIABLE_INSTRUMENTS,
  INITIAL_UNDERLYING_ASSETS,
} from '../engines/instrumentRegistry';
import { FxRateTable } from '../engines/portfolioEngine';
import {
  getActiveFrontendSupabaseConfig,
  getOrInitFrontendSupabaseClient,
  saveFrontendSupabaseAnonKey,
} from '../lib/supabaseClient';

const OWNER_SESSION_STORAGE_KEY = 'deminvest_owner_session_v1';

function normalizeEmailForSupabaseGoTrue(rawEmail: string): string {
  const clean = rawEmail.trim().toLowerCase();
  if (clean.endsWith('.local')) {
    return clean.replace(/\.local$/, '.com');
  }
  return clean;
}

function buildSupabaseHeaders(extra?: Record<string, string>): Record<string, string> {
  const cfg = getActiveFrontendSupabaseConfig();
  const headers: Record<string, string> = { ...(extra || {}) };
  if (cfg.url) headers['x-deminvest-supabase-url'] = cfg.url;
  if (cfg.anonKey) headers['x-deminvest-supabase-anon-key'] = cfg.anonKey;
  return headers;
}

async function syncOwnerToSupabaseFromBrowser(
  email: string,
  password: string,
  userProfile: UserProfileAndPreferences
): Promise<void> {
  const sbClient = getOrInitFrontendSupabaseClient();
  if (!sbClient) return;

  const sbEmail = normalizeEmailForSupabaseGoTrue(email);
  try {
    let authUserId: string | null = null;
    const signInRes = await sbClient.auth.signInWithPassword({
      email: sbEmail,
      password,
    });
    if (signInRes.data?.user?.id) {
      authUserId = signInRes.data.user.id;
    } else {
      const signUpRes = await sbClient.auth.signUp({
        email: sbEmail,
        password,
        options: {
          data: {
            display_name: userProfile.displayName,
            is_owner: true,
          },
        },
      });
      if (signUpRes.data?.user?.id) {
        authUserId = signUpRes.data.user.id;
      }
    }

    if (authUserId) {
      await sbClient.from('profiles').upsert(
        {
          id: authUserId,
          email: sbEmail,
          display_name: userProfile.displayName,
          is_owner: true,
          onboarding_completed: userProfile.onboardingCompleted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      await sbClient.from('user_preferences').upsert(
        {
          user_id: authUserId,
          ui_mode: userProfile.uiMode,
          theme: userProfile.theme,
          preferred_currency: userProfile.preferredCurrency,
          timezone: userProfile.timezone,
          experience_level: userProfile.experienceLevel,
          risk_tolerance: userProfile.riskTolerance,
          investment_goals: userProfile.investmentGoals,
          preferred_horizons: userProfile.preferredHorizons,
          preferred_markets: userProfile.preferredMarkets,
          quiet_hours_start: userProfile.quietHoursStart,
          quiet_hours_end: userProfile.quietHoursEnd,
          max_daily_notifications: userProfile.maxDailyNotifications,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }
  } catch {
    // Sincronizzazione gestita anche lato server via REST
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface DemInvestContextValue {
  isLoading: boolean;
  isOffline: boolean;
  singleUserMode: boolean;
  hasOwnerAccount: boolean;
  isAuthenticated: boolean;
  user: UserProfileAndPreferences | null;
  uiMode: UIMode;
  theme: ThemeMode;
  dataExecutionMode: DataExecutionMode;
  selectedInstrumentId: string;
  selectedBrokerCode: string;
  activeHorizon: TimeHorizon;
  isAiDrawerOpen: boolean;
  assets: UnderlyingAsset[];
  instruments: NegotiableInstrument[];
  brokerMappings: BrokerInstrumentMapping[];
  quotes: Record<string, MarketQuote>;
  fxTable: FxRateTable | null;
  portfolioAnalytics: PortfolioAnalyticsSummary | null;
  watchlistInstrumentIds: string[];
  alertRules: AlertRule[];
  generatedSignals: GeneratedSignal[];
  notifications: NotificationItem[];
  portfolioTransactions: PortfolioTransaction[];
  paperAccount: PaperAccountState | null;
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
  schedulerStatus: SchedulerStatusInfo | null;
  providersHealth: ProviderHealthInfo[];
  supabaseDiagnostics: SupabaseSyncDiagnostics | null;
  vapidPublicKey: string;
  pushPermissionState: NotificationPermission | 'unsupported';
  latestMarketScan: MarketScanRunResult | null;
  isScanningMarket: boolean;
  // Actions
  setUiMode: (mode: UIMode) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setDataExecutionMode: (mode: DataExecutionMode) => Promise<void>;
  setSelectedInstrumentId: (id: string) => void;
  setSelectedBrokerCode: (code: string) => void;
  setActiveHorizon: (horizon: TimeHorizon) => void;
  setIsAiDrawerOpen: (open: boolean) => void;
  registerOwner: (params: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  loginOwner: (params: {
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logoutOwner: () => Promise<void>;
  updateUserProfile: (patch: Partial<UserProfileAndPreferences>) => Promise<void>;
  refreshMarketQuotes: () => Promise<void>;
  toggleWatchlist: (instrumentId: string) => Promise<void>;
  createAlertRule: (rule: Partial<AlertRule>) => Promise<void>;
  toggleAlertRule: (ruleId: string) => Promise<void>;
  deleteAlertRule: (ruleId: string) => Promise<void>;
  subscribeBrowserWebPush: () => Promise<{ ok: boolean; message: string }>;
  sendRealTestPushNotification: () => Promise<{ ok: boolean; message: string }>;
  markAllNotificationsRead: () => Promise<void>;
  triggerSchedulerNow: () => Promise<void>;
  addPortfolioTransaction: (tx: Partial<PortfolioTransaction>) => Promise<void>;
  deletePortfolioTransaction: (txId: string) => Promise<void>;
  importPortfolioCsv: (csvText: string) => Promise<{ importedCount: number; errors: string[] }>;
  importBrokerMappingsCsv: (csvText: string) => Promise<{ importedCount: number; errors: string[] }>;
  confirmBrokerMappingManually: (mapping: Partial<BrokerInstrumentMapping>) => Promise<void>;
  registerCoinGeckoAsset: (params: {
    coingeckoId: string;
    symbol: string;
    name: string;
  }) => Promise<NegotiableInstrument | null>;
  executePaperOrder: (params: {
    instrumentId: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    spreadBps?: number;
    slippageBps?: number;
    commissionPct?: number;
    stopLoss?: number;
    takeProfit?: number;
    rationaleNotes?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  resetPaperAccount: (initialCapital?: number) => Promise<void>;
  addJournalEntry: (entry: {
    instrumentId?: string;
    title: string;
    hypothesis: string;
    outcomeReview: string;
    emotionalState: string;
    lessonsLearned: string;
  }) => Promise<void>;
  sendAiMessage: (prompt: string) => Promise<void>;
  saveBackendProviderKey: (keyName: string, secretValue: string) => Promise<void>;
  reconcileSupabaseNow: (params?: {
    password?: string;
    email?: string;
    displayName?: string;
  }) => Promise<{ ok: boolean; diagnostics: SupabaseSyncDiagnostics | null }>;
  runMarketIntelligenceScan: (
    filters?: MarketScanFilterParams
  ) => Promise<MarketScanRunResult | null>;
  simulatePosition: (
    input: PositionSimulationInput
  ) => Promise<PositionSimulationResult | null>;
}

const DemInvestContext = createContext<DemInvestContextValue | undefined>(undefined);

export const DemInvestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [singleUserMode, setSingleUserMode] = useState(true);
  const [hasOwnerAccount, setHasOwnerAccount] = useState(() => {
    return Boolean(localStorage.getItem(OWNER_SESSION_STORAGE_KEY));
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfileAndPreferences | null>(null);

  const [uiMode, setUiModeState] = useState<UIMode>(
    () => (localStorage.getItem('deminvest_ui_mode') as UIMode) || 'SIMPLE'
  );
  const [theme, setThemeState] = useState<ThemeMode>(
    () => (localStorage.getItem('deminvest_theme') as ThemeMode) || 'DARK'
  );
  const [dataExecutionMode, setDataExecutionModeState] = useState<DataExecutionMode>(
    () => (localStorage.getItem('deminvest_data_mode') as DataExecutionMode) || 'LIVE'
  );

  const [selectedInstrumentId, setSelectedInstrumentId] = useState('INST_BTC_USD_SPOT');
  const [selectedBrokerCode, setSelectedBrokerCode] = useState('TRADE_REPUBLIC');
  const [activeHorizon, setActiveHorizon] = useState<TimeHorizon>('BREVE');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  const [assets, setAssets] = useState<UnderlyingAsset[]>(INITIAL_UNDERLYING_ASSETS);
  const [instruments, setInstruments] = useState<NegotiableInstrument[]>(
    INITIAL_NEGOTIABLE_INSTRUMENTS
  );
  const [brokerMappings, setBrokerMappings] =
    useState<BrokerInstrumentMapping[]>(INITIAL_BROKER_MAPPINGS);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [fxTable, setFxTable] = useState<FxRateTable | null>(null);
  const [portfolioAnalytics, setPortfolioAnalytics] =
    useState<PortfolioAnalyticsSummary | null>(null);

  const [watchlistInstrumentIds, setWatchlistInstrumentIds] = useState<string[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [generatedSignals, setGeneratedSignals] = useState<GeneratedSignal[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [portfolioTransactions, setPortfolioTransactions] = useState<PortfolioTransaction[]>([]);
  const [paperAccount, setPaperAccount] = useState<PaperAccountState | null>(null);
  const [journalEntries, setJournalEntries] = useState<DemInvestContextValue['journalEntries']>([]);
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>([]);
  const [aiToolLogs, setAiToolLogs] = useState<AIToolCallLog[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatusInfo | null>(null);
  const [providersHealth, setProvidersHealth] = useState<ProviderHealthInfo[]>([]);
  const [supabaseDiagnostics, setSupabaseDiagnostics] =
    useState<SupabaseSyncDiagnostics | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [pushPermissionState, setPushPermissionState] = useState<
    NotificationPermission | 'unsupported'
  >(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const [latestMarketScan, setLatestMarketScan] = useState<MarketScanRunResult | null>(null);
  const [isScanningMarket, setIsScanningMarket] = useState(false);

  // Sincronizza classe dark/light sul documento
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'DARK') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('deminvest_theme', theme);
  }, [theme]);

  // Monitora stato online/offline
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const refreshMarketQuotes = useCallback(
    async (overrideMode?: DataExecutionMode) => {
      const modeToUse = overrideMode || dataExecutionMode;
      try {
        const res = await fetch(`/api/market/batch-quotes?mode=${modeToUse}`, {
          headers: buildSupabaseHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.quotes) setQuotes(data.quotes);
        if (data.fxTable) setFxTable(data.fxTable);
        if (data.portfolioAnalytics) setPortfolioAnalytics(data.portfolioAnalytics);
        if (data.providersHealth) setProvidersHealth(data.providersHealth);
      } catch {
        // gestito tramite stato offline / validità
      }
    },
    [dataExecutionMode]
  );

  const loadBootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/bootstrap', {
        headers: buildSupabaseHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSingleUserMode(Boolean(data.singleUserMode));

        // Ripristino automatico della sessione proprietaria se l'isolate Cloudflare Edge si è riavviato
        const cachedRaw = localStorage.getItem(OWNER_SESSION_STORAGE_KEY);
        let cachedSession: { user?: UserProfileAndPreferences } | null = null;
        if (cachedRaw) {
          try {
            cachedSession = JSON.parse(cachedRaw);
          } catch {
            cachedSession = null;
          }
        }

        if (data.isAuthenticated && data.user) {
          setHasOwnerAccount(true);
          setIsAuthenticated(true);
          setUser(data.user);
          setUiModeState(data.user.uiMode || 'SIMPLE');
          setThemeState(data.user.theme || 'DARK');
          setDataExecutionModeState(data.user.dataExecutionMode || 'LIVE');
          localStorage.setItem(
            OWNER_SESSION_STORAGE_KEY,
            JSON.stringify({ user: data.user, updatedAt: new Date().toISOString() })
          );
        } else if (cachedSession?.user && cachedSession.user.onboardingCompleted) {
          // Auto-reidratazione trasparente dopo cold-start dell'isolate Cloudflare Worker
          setHasOwnerAccount(true);
          setIsAuthenticated(true);
          setUser(cachedSession.user);
          setUiModeState(cachedSession.user.uiMode || 'SIMPLE');
          setThemeState(cachedSession.user.theme || 'DARK');
          setDataExecutionModeState(cachedSession.user.dataExecutionMode || 'LIVE');
          void fetch('/api/supabase/reconcile', {
            method: 'POST',
            headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              email: cachedSession.user.email,
              displayName: cachedSession.user.displayName,
            }),
          }).catch(() => null);
        } else {
          setHasOwnerAccount(Boolean(data.hasOwnerAccount || cachedSession?.user));
          setIsAuthenticated(Boolean(data.isAuthenticated));
          if (data.user) {
            setUser(data.user);
          }
        }

        if (data.assets) setAssets(data.assets);
        if (data.instruments) setInstruments(data.instruments);
        if (data.brokerMappings) setBrokerMappings(data.brokerMappings);
        if (data.watchlistInstrumentIds) setWatchlistInstrumentIds(data.watchlistInstrumentIds);
        if (data.alertRules) setAlertRules(data.alertRules);
        if (data.generatedSignals) setGeneratedSignals(data.generatedSignals);
        if (data.notifications) setNotifications(data.notifications);
        if (data.portfolioTransactions) setPortfolioTransactions(data.portfolioTransactions);
        if (data.paperAccount) setPaperAccount(data.paperAccount);
        if (data.journalEntries) setJournalEntries(data.journalEntries);
        if (data.aiMessages) setAiMessages(data.aiMessages);
        if (data.aiToolLogs) setAiToolLogs(data.aiToolLogs);
        if (data.schedulerStatus) setSchedulerStatus(data.schedulerStatus);
        if (data.providersHealth) setProvidersHealth(data.providersHealth);
        if (data.supabaseDiagnostics) setSupabaseDiagnostics(data.supabaseDiagnostics);
        if (data.vapidPublicKey) setVapidPublicKey(data.vapidPublicKey);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    refreshMarketQuotes();
    const timer = setInterval(() => {
      refreshMarketQuotes();
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [refreshMarketQuotes]);

  const updateUserProfile = async (patch: Partial<UserProfileAndPreferences>) => {
    const res = await fetch('/api/profile/update', {
      method: 'POST',
      headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      localStorage.setItem(
        OWNER_SESSION_STORAGE_KEY,
        JSON.stringify({ user: data.user, updatedAt: new Date().toISOString() })
      );
      if (data.supabaseDiagnostics) {
        setSupabaseDiagnostics(data.supabaseDiagnostics);
      }
    }
  };

  const setUiMode = async (mode: UIMode) => {
    setUiModeState(mode);
    localStorage.setItem('deminvest_ui_mode', mode);
    if (isAuthenticated) {
      await updateUserProfile({ uiMode: mode });
    }
  };

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('deminvest_theme', newTheme);
    if (isAuthenticated) {
      await updateUserProfile({ theme: newTheme });
    }
  };

  const setDataExecutionMode = async (mode: DataExecutionMode) => {
    setDataExecutionModeState(mode);
    localStorage.setItem('deminvest_data_mode', mode);
    await refreshMarketQuotes(mode);
    if (isAuthenticated) {
      await updateUserProfile({ dataExecutionMode: mode });
    }
  };

  const registerOwner = async (params: {
    email: string;
    password: string;
    displayName: string;
  }) => {
    const normalizedEmail = normalizeEmailForSupabaseGoTrue(params.email);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...params, email: normalizedEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Errore di registrazione' };
    }
    await syncOwnerToSupabaseFromBrowser(normalizedEmail, params.password, data.user);
    setHasOwnerAccount(true);
    setIsAuthenticated(true);
    setUser(data.user);
    localStorage.setItem(
      OWNER_SESSION_STORAGE_KEY,
      JSON.stringify({ user: data.user, updatedAt: new Date().toISOString() })
    );
    if (data.supabaseDiagnostics) setSupabaseDiagnostics(data.supabaseDiagnostics);
    return { ok: true };
  };

  const loginOwner = async (params: { email: string; password: string }) => {
    const normalizedEmail = normalizeEmailForSupabaseGoTrue(params.email);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...params, email: normalizedEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Credenziali non valide' };
    }
    await syncOwnerToSupabaseFromBrowser(normalizedEmail, params.password, data.user);
    setHasOwnerAccount(true);
    setIsAuthenticated(true);
    setUser(data.user);
    localStorage.setItem(
      OWNER_SESSION_STORAGE_KEY,
      JSON.stringify({ user: data.user, updatedAt: new Date().toISOString() })
    );
    if (data.supabaseDiagnostics) setSupabaseDiagnostics(data.supabaseDiagnostics);
    return { ok: true };
  };

  const logoutOwner = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: buildSupabaseHeaders(),
    });
    localStorage.removeItem(OWNER_SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setUser(null);
  };

  const toggleWatchlist = async (instrumentId: string) => {
    const res = await fetch('/api/watchlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instrumentId }),
    });
    if (res.ok) {
      const data = await res.json();
      setWatchlistInstrumentIds(data.watchlistInstrumentIds);
    }
  };

  const createAlertRule = async (rule: Partial<AlertRule>) => {
    const res = await fetch('/api/alerts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (res.ok) {
      const data = await res.json();
      setAlertRules(data.alertRules);
    }
  };

  const toggleAlertRule = async (ruleId: string) => {
    const res = await fetch('/api/alerts/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlertRules(data.alertRules);
    }
  };

  const deleteAlertRule = async (ruleId: string) => {
    const res = await fetch('/api/alerts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlertRules(data.alertRules);
    }
  };

  const subscribeBrowserWebPush = async (): Promise<{ ok: boolean; message: string }> => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return {
        ok: false,
        message: 'Il browser corrente non supporta le API Web Push / Service Worker.',
      };
    }

    const permission = await Notification.requestPermission();
    setPushPermissionState(permission);
    if (permission !== 'granted') {
      return {
        ok: false,
        message:
          'Permesso notifiche negato dal browser. Abilita le notifiche nelle impostazioni del sito per ricevere Web Push.',
      };
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      if (vapidPublicKey && reg.pushManager) {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      }
      return {
        ok: true,
        message: 'Sottoscrizione Web Push VAPID registrata con successo sul backend.',
      };
    } catch (err) {
      return {
        ok: true,
        message: `Permesso concesso (${err instanceof Error ? err.message : 'Service Worker attivo'}).`,
      };
    }
  };

  const sendRealTestPushNotification = async (): Promise<{ ok: boolean; message: string }> => {
    const res = await fetch('/api/push/test', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.error || 'Errore durante l\'invio della notifica di test.' };
    }
    setNotifications(data.notifications);

    // Se il permesso notifiche del browser è attivo, mostra anche tramite Service Worker locale
    if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
        await reg.showNotification(data.notification.title, {
          body: data.notification.body,
          icon: isAndroid ? '/icons/transparent.png' : '/icons/icon-192.png',
          badge: '/icons/icon-192-transparent.png',
          tag: 'deminvest-test-push',
        });
      } catch {
        // Gestito dal push server-side
      }
    }

    return {
      ok: true,
      message: 'Notifica Web Push di test generata dal backend e registrata nel Centro Notifiche.',
    };
  };

  const markAllNotificationsRead = async () => {
    const res = await fetch('/api/notifications/mark-read', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
    }
  };

  const triggerSchedulerNow = async () => {
    const res = await fetch('/api/scheduler/run-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: dataExecutionMode }),
    });
    if (res.ok) {
      const data = await res.json();
      setSchedulerStatus(data.schedulerStatus);
      setGeneratedSignals(data.generatedSignals);
      setNotifications(data.notifications);
      setAlertRules(data.alertRules);
    }
  };

  const addPortfolioTransaction = async (tx: Partial<PortfolioTransaction>) => {
    const res = await fetch('/api/portfolio/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (res.ok) {
      const data = await res.json();
      setPortfolioTransactions(data.portfolioTransactions);
      await refreshMarketQuotes();
    }
  };

  const deletePortfolioTransaction = async (txId: string) => {
    const res = await fetch('/api/portfolio/delete-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txId }),
    });
    if (res.ok) {
      const data = await res.json();
      setPortfolioTransactions(data.portfolioTransactions);
      await refreshMarketQuotes();
    }
  };

  const importPortfolioCsv = async (csvText: string) => {
    const res = await fetch('/api/portfolio/import-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText }),
    });
    const data = await res.json();
    if (res.ok && data.portfolioTransactions) {
      setPortfolioTransactions(data.portfolioTransactions);
      await refreshMarketQuotes();
    }
    return {
      importedCount: data.importedCount || 0,
      errors: data.errors || [],
    };
  };

  const importBrokerMappingsCsv = async (csvText: string) => {
    const res = await fetch('/api/broker/import-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText }),
    });
    const data = await res.json();
    if (res.ok && data.brokerMappings) {
      setBrokerMappings(data.brokerMappings);
    }
    return {
      importedCount: data.importedCount || 0,
      errors: data.errors || [],
    };
  };

  const confirmBrokerMappingManually = async (mapping: Partial<BrokerInstrumentMapping>) => {
    const res = await fetch('/api/broker/confirm-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping),
    });
    if (res.ok) {
      const data = await res.json();
      setBrokerMappings(data.brokerMappings);
    }
  };

  const registerCoinGeckoAsset = async (params: {
    coingeckoId: string;
    symbol: string;
    name: string;
  }) => {
    const res = await fetch('/api/market/register-coingecko', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setInstruments(data.instruments);
    setAssets(data.assets);
    await refreshMarketQuotes();
    return data.instrument as NegotiableInstrument;
  };

  const executePaperOrder: DemInvestContextValue['executePaperOrder'] = async (params) => {
    const res = await fetch('/api/paper/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, mode: dataExecutionMode }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Errore esecuzione ordine simulato' };
    }
    setPaperAccount(data.paperAccount);
    return { ok: true };
  };

  const resetPaperAccount = async (initialCapital = 25000) => {
    const res = await fetch('/api/paper/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialCapital }),
    });
    if (res.ok) {
      const data = await res.json();
      setPaperAccount(data.paperAccount);
    }
  };

  const addJournalEntry: DemInvestContextValue['addJournalEntry'] = async (entry) => {
    const res = await fetch('/api/lab/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (res.ok) {
      const data = await res.json();
      setJournalEntries(data.journalEntries);
    }
  };

  const sendAiMessage = async (prompt: string) => {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        contextInstrumentId: selectedInstrumentId,
        activeHorizon,
        selectedBrokerCode,
        dataExecutionMode,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setAiMessages(data.aiMessages);
      setAiToolLogs(data.aiToolLogs);
    }
  };

  const saveBackendProviderKey = async (keyName: string, secretValue: string) => {
    if (keyName === 'SUPABASE_ANON_KEY' && secretValue.trim()) {
      saveFrontendSupabaseAnonKey(secretValue.trim());
    }
    const res = await fetch('/api/settings/provider-key', {
      method: 'POST',
      headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ keyName, secretValue }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.providersHealth) setProvidersHealth(data.providersHealth);
      if (data.supabaseDiagnostics) setSupabaseDiagnostics(data.supabaseDiagnostics);
      await refreshMarketQuotes();
    }
  };

  const reconcileSupabaseNow: DemInvestContextValue['reconcileSupabaseNow'] = async (params) => {
    const res = await fetch('/api/supabase/reconcile', {
      method: 'POST',
      headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        password: params?.password,
        email: params?.email || user?.email,
        displayName: params?.displayName || user?.displayName,
      }),
    });
    if (!res.ok) {
      return { ok: false, diagnostics: supabaseDiagnostics };
    }
    const data = await res.json();
    if (data.supabaseDiagnostics) {
      setSupabaseDiagnostics(data.supabaseDiagnostics);
    }
    if (data.user) {
      setUser(data.user);
      setHasOwnerAccount(true);
    }
    return { ok: true, diagnostics: data.supabaseDiagnostics || null };
  };

  const runMarketIntelligenceScan: DemInvestContextValue['runMarketIntelligenceScan'] = useCallback(
    async (filters?: MarketScanFilterParams) => {
      setIsScanningMarket(true);
      try {
        const res = await fetch('/api/intelligence/scan', {
          method: 'POST',
          headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            filters: {
              horizon: activeHorizon,
              ...(filters || {}),
            },
            mode: dataExecutionMode,
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.scanResult) {
          setLatestMarketScan(data.scanResult);
          return data.scanResult as MarketScanRunResult;
        }
        return null;
      } catch {
        return null;
      } finally {
        setIsScanningMarket(false);
      }
    },
    [activeHorizon, dataExecutionMode]
  );

  const simulatePosition: DemInvestContextValue['simulatePosition'] = async (input) => {
    try {
      const res = await fetch('/api/intelligence/simulate-position', {
        method: 'POST',
        headers: buildSupabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.simulation as PositionSimulationResult) || null;
    } catch {
      return null;
    }
  };

  return (
    <DemInvestContext.Provider
      value={{
        isLoading,
        isOffline,
        singleUserMode,
        hasOwnerAccount,
        isAuthenticated,
        user,
        uiMode,
        theme,
        dataExecutionMode,
        selectedInstrumentId,
        selectedBrokerCode,
        activeHorizon,
        isAiDrawerOpen,
        assets,
        instruments,
        brokerMappings,
        quotes,
        fxTable,
        portfolioAnalytics,
        watchlistInstrumentIds,
        alertRules,
        generatedSignals,
        notifications,
        portfolioTransactions,
        paperAccount,
        journalEntries,
        aiMessages,
        aiToolLogs,
        schedulerStatus,
        providersHealth,
        supabaseDiagnostics,
        vapidPublicKey,
        pushPermissionState,
        latestMarketScan,
        isScanningMarket,
        setUiMode,
        setTheme,
        setDataExecutionMode,
        setSelectedInstrumentId,
        setSelectedBrokerCode,
        setActiveHorizon,
        setIsAiDrawerOpen,
        registerOwner,
        loginOwner,
        logoutOwner,
        updateUserProfile,
        refreshMarketQuotes,
        toggleWatchlist,
        createAlertRule,
        toggleAlertRule,
        deleteAlertRule,
        subscribeBrowserWebPush,
        sendRealTestPushNotification,
        markAllNotificationsRead,
        triggerSchedulerNow,
        addPortfolioTransaction,
        deletePortfolioTransaction,
        importPortfolioCsv,
        importBrokerMappingsCsv,
        confirmBrokerMappingManually,
        registerCoinGeckoAsset,
        executePaperOrder,
        resetPaperAccount,
        addJournalEntry,
        sendAiMessage,
        saveBackendProviderKey,
        reconcileSupabaseNow,
        runMarketIntelligenceScan,
        simulatePosition,
      }}
    >
      {children}
    </DemInvestContext.Provider>
  );
};

export function useDemInvest(): DemInvestContextValue {
  const ctx = useContext(DemInvestContext);
  if (!ctx) {
    throw new Error('useDemInvest deve essere utilizzato all\'interno di DemInvestProvider');
  }
  return ctx;
}

