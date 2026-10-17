// ==============================================================================
// DEMINVEST — DOMINIO FINANZIARIO E TIPI RIGOROSI (TypeScript Strict Mode)
// ==============================================================================

export type UIMode = 'SIMPLE' | 'PRO';
export type ThemeMode = 'DARK' | 'LIGHT';
export type DataExecutionMode = 'LIVE' | 'DEMO';

export type AssetClass =
  | 'EQUITY'
  | 'ETF'
  | 'CRYPTO'
  | 'INDEX'
  | 'FOREX'
  | 'BOND'
  | 'COMMODITY'
  | 'DERIVATIVE';

export type InstrumentType =
  | 'SPOT_CRYPTO'
  | 'CASH_EQUITY'
  | 'UCITS_ETF'
  | 'US_ETF'
  | 'SPOT_FOREX'
  | 'INDEX_SPOT'
  | 'BOND_GOVT'
  | 'COMMODITY_SPOT'
  | 'CFD'
  | 'FUTURE';

export type TimeHorizon = 'BREVISSIMO' | 'BREVE' | 'MEDIO' | 'LUNGO';
export type CandleTimeframe = '15m' | '1h' | '4h' | '1d' | '1w';

export type FreshnessStatus = 'REALTIME' | 'DELAYED' | 'EOD' | 'STALE';
export type QuoteValidityStatus = 'VALID' | 'STALE' | 'INCOMPLETE' | 'SUSPENDED';

export type BrokerVerificationStatus = 'VERIFIED' | 'USER_CONFIRMED' | 'UNVERIFIED';
export type PlatformType = 'BROKER' | 'TERMINAL' | 'EXCHANGE' | 'BANK_PLATFORM';
export type ContractType = 'SPOT' | 'CASH_SHARE' | 'ETF_SHARE' | 'CFD' | 'PERPETUAL' | 'FUTURE';

export type SignalType =
  | 'BUY_SETUP'
  | 'SELL_SETUP'
  | 'BREAKOUT_ALERT'
  | 'BREAKDOWN_ALERT'
  | 'TREND_CHANGE'
  | 'RISK_ALERT'
  | 'PRICE_ALERT'
  | 'EVENT_ALERT'
  | 'NO_TRADE';

export type SignalStatus =
  | 'DETECTED'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'CANCELLED';

export type ProviderStatus =
  | 'UNCONFIGURED'
  | 'CONFIGURED'
  | 'TESTED'
  | 'OPERATIONAL'
  | 'OPERATIONAL_SANDBOX'
  | 'SUSPENDED'
  | 'ERROR';

export interface TradingVenue {
  micCode: string;
  name: string;
  countryCode: string;
  timezone: string;
  currency: string;
  openTime: string;
  closeTime: string;
  is24x7: boolean;
}

/**
 * 1. Sottostante Economico (Universal Instrument Registry)
 */
export interface UnderlyingAsset {
  id: string;
  canonicalSymbol: string;
  name: string;
  assetClass: AssetClass;
  isin?: string;
  coingeckoId?: string;
  issuerName?: string;
  blockchain?: string;
  network?: string;
  contractAddress?: string;
  decimals?: number;
  baseCurrency: string;
  sector?: string;
  country?: string;
  description: string;
}

/**
 * 2. Strumento Negoziabile distinto dal sottostante e dal broker
 */
export interface NegotiableInstrument {
  id: string;
  underlyingAssetId: string;
  instrumentType: InstrumentType;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  venueMic: string;
  venueName: string;
  quoteCurrency: string;
  baseAssetSymbol?: string;
  quoteAssetSymbol?: string;
  isin?: string;
  coingeckoId?: string;
  isDerivative: boolean;
  primaryProviderId: 'coingecko' | 'twelvedata' | 'alphavantage' | 'fred' | 'ecb_frankfurter';
  providerSymbol: string;
  secondaryProviderId?: 'coingecko' | 'twelvedata' | 'alphavantage';
  secondaryProviderSymbol?: string;
  liquidityTier: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * 3. Broker Instrument Mapping con stato di verifica esplicito
 */
export interface BrokerInstrumentMapping {
  id: string;
  instrumentId: string;
  underlyingAssetId: string;
  brokerCode: 'TRADE_REPUBLIC' | 'AVATRADE' | 'MT4' | 'MT5' | 'IBKR' | string;
  brokerName: string;
  platformType: PlatformType;
  brokerSymbol: string;
  brokerInstrumentName: string;
  contractType: ContractType;
  currency: string;
  venueLabel: string;
  verificationStatus: BrokerVerificationStatus;
  verificationSource: string;
  maxLeverage?: number;
  contractSize?: number;
  tickSize?: number;
  tickValue?: number;
  typicalSpreadBps?: number;
  commissionNotes: string;
  tradingConditionsNotes: string;
  spotVsDerivativeWarning?: string;
  officialExternalUrl?: string;
  lastVerifiedAt: string;
}

/**
 * 4. Quotazione normalizzata con qualità e freschezza obbligatorie
 */
export interface MarketQuote {
  instrumentId: string;
  price: number;
  open?: number;
  high24h?: number;
  low24h?: number;
  previousClose?: number;
  changeAbs: number;
  changePct: number;
  volume24h?: number;
  marketCap?: number;
  currency: string;
  providerId: string;
  providerName: string;
  venueMic: string;
  observedAt: string; // ISO UTC della rilevazione del dato alla fonte
  fetchedAt: string;  // ISO UTC dell'ultima acquisizione dal backend
  freshness: FreshnessStatus;
  delaySeconds: number;
  validity: QuoteValidityStatus;
  isMarketOpen: boolean;
  isDemoData: boolean;
  statusMessage?: string;
}

/**
 * 5. Candela storica OHLCV
 */
export interface HistoricalCandle {
  time: number; // Unix timestamp in seconds (UTC)
  isoTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
  providerId: string;
  isDemoData?: boolean;
}

/**
 * 6. Supporti e Resistenze calcolati deterministicamente
 */
export interface SupportResistanceLevel {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  touches: number;
  strengthScore: number; // 1-100
  firstTestedAt: string;
  lastTestedAt: string;
  algorithm: 'PIVOT_FRACTAL_ATR_CLUSTER_V1';
}

export interface ConfirmedPivotPoint {
  price: number;
  type: 'PIVOT_HIGH' | 'PIVOT_LOW';
  leftBars: number;
  rightBars: number;
  pivotCandleTime: string; // Timestamp della candela su cui si è formato il massimo/minimo
  confirmedAtCandleTime: string; // Timestamp della candela N successiva che conferma il pivot senza look-ahead bias
  strengthScore: number;
  broken: boolean;
  falseBreakoutDetected: boolean;
}

/**
 * 6b. Audit di Qualità e Validazione Dati di Mercato (Fail-Safe Layer)
 */
export type MarketDataQualityClassification =
  | 'VALID'
  | 'DELAYED'
  | 'STALE'
  | 'INCOMPLETE'
  | 'INVALID'
  | 'UNAVAILABLE';

export interface DataQualityAuditReport {
  instrumentId: string;
  timeframe: CandleTimeframe;
  evaluatedAt: string;
  classification: MarketDataQualityClassification;
  pricePositiveCheck: boolean;
  ohlcCoherenceCheck: boolean;
  noDuplicateTimestampsCheck: boolean;
  chronologicalOrderCheck: boolean;
  noFutureTimestampsCheck: boolean;
  totalCandlesReceived: number;
  validClosedCandlesCount: number;
  formingCandlesExcluded: number;
  invalidCandlesDropped: number;
  volumeReliable: boolean;
  volumeUnavailableReason?: string;
  anomalyFlags: string[];
  isSpotVsDerivativeDistinguished: boolean;
  instrumentContractNature: 'SPOT' | 'DERIVATIVE_CFD_FUTURE';
  isMarketSessionOpen: boolean;
  delaySeconds: number;
  blockingSignalGeneration: boolean;
  blockingReasons: string[];
}

/**
 * 7. Indicatori Quantitativi Deterministici (Estesi Prompt 3)
 */
export interface QuantitativeIndicatorsSnapshot {
  instrumentId: string;
  timeframe: CandleTimeframe;
  calculatedAt: string;
  observationsCount: number;
  sufficientData: boolean;
  insufficientReason?: string;
  latestClose: number;
  // Trend
  sma20: number | null;
  sma50: number | null;
  sma100?: number | null;
  sma200: number | null;
  ema9?: number | null;
  ema12: number | null;
  ema20: number | null;
  ema26: number | null;
  ema50?: number | null;
  ema200?: number | null;
  adx14: number | null;
  plusDi14?: number | null;
  minusDi14?: number | null;
  distanceFromSma20Pct: number | null;
  distanceFromSma50Pct: number | null;
  distanceFromSma200Pct?: number | null;
  sma20SlopeNormalizedPct?: number | null;
  ema20SlopeNormalizedPct?: number | null;
  ema50SlopeNormalizedPct?: number | null;
  marketStructureSequence?:
    | 'HIGHER_HIGHS_HIGHER_LOWS'
    | 'LOWER_HIGHS_LOWER_LOWS'
    | 'MIXED_RANGE'
    | 'INSUFFICIENT_DATA';
  trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'INSUFFICIENT_DATA';
  // Momentum
  rsi14: number | null;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  } | null;
  roc10: number | null;
  momentum10?: number | null;
  stochastic14: {
    k: number;
    d: number;
  } | null;
  // Volatilità
  atr14: number | null;
  atrPct: number | null;
  trueRangeLatest?: number | null;
  bollingerBands20: {
    upper: number;
    middle: number;
    lower: number;
    bandwidthPct: number;
    percentB: number;
  } | null;
  historicalVolatilityAnnualizedPct: number | null;
  maxDrawdownPct: number | null;
  currentDrawdownFromPeakPct?: number | null;
  // Volume
  volumeSma20: number | null;
  relativeVolume: number | null;
  obv: number | null;
  volumeAvailableAndReliable?: boolean;
  priceVolumeConfirmation?:
    | 'CONFIRMED_BULLISH'
    | 'CONFIRMED_BEARISH'
    | 'DIVERGENT_WEAK'
    | 'UNAVAILABLE_PROVIDER_VOLUME';
  volumeAnomaly: 'NONE' | 'HIGH_VOLUME_SPIKE' | 'LOW_VOLUME_DRYUP';
  // Prezzi & Struttura
  periodHigh: number | null;
  periodLow: number | null;
  supports: SupportResistanceLevel[];
  resistances: SupportResistanceLevel[];
  confirmedPivotHighs?: ConfirmedPivotPoint[];
  confirmedPivotLows?: ConfirmedPivotPoint[];
  priceStructure: 'BREAKOUT' | 'BREAKDOWN' | 'PULLBACK_IN_UPTREND' | 'CONSOLIDATION_RANGE' | 'NORMAL';
  supportResistanceAlgorithmDoc: string;
}

/**
 * 8. Configurazione Orizzonti Temporali
 */
export interface TimeHorizonConfig {
  horizon: TimeHorizon;
  label: string;
  durationDescription: string;
  recommendedTimeframes: CandleTimeframe[];
  maxAllowedDataDelaySeconds: number;
  requiresRealtimeOrNearRealtime: boolean;
  methodologyFocus: string[];
  primaryRisks: string[];
}

/**
 * 9. Segnale Deterministico (Signal Intelligence Engine)
 */
export interface GeneratedSignal {
  id: string;
  assetId: string;
  instrumentId: string;
  instrumentTicker: string;
  instrumentName: string;
  verifiedBrokerCode?: string;
  verifiedBrokerSymbol?: string;
  signalType: SignalType;
  status: SignalStatus;
  horizon: TimeHorizon;
  timeframe: CandleTimeframe;
  strategyId: string;
  strategyName: string;
  strategyVersion: string;
  observedPrice: number;
  currency: string;
  providerId: string;
  quoteObservedAt: string;
  quoteFreshness: FreshnessStatus;
  heuristicScore: number; // 0..100 — Esplicitamente indicato come Punteggio Euristico, MAI probabilità
  scoreBreakdown: {
    trendScore: number;
    momentumScore: number;
    volatilityRiskScore: number;
    volumeConfirmationScore: number;
    dataQualityScore: number;
  };
  indicatorsSnapshot: {
    rsi14: number | null;
    sma20: number | null;
    sma50: number | null;
    ema20: number | null;
    macdHistogram: number | null;
    atr14: number | null;
    adx14: number | null;
    relativeVolume: number | null;
  };
  conditionsMet: string[];
  conditionsUnmet: string[];
  interestLevel: number | null;
  invalidationLevel: number | null;
  scenarioTargets: number[];
  keyRisks: string[];
  quantitativeRationale: string;
  aiExplanation?: string;
  detectedAt: string;
  expiresAt: string;
  statusUpdatedAt: string;
  dedupHash: string;
  isDemoData: boolean;
}

/**
 * 10. Regole di Alert & Notifiche
 */
export type AlertRuleType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PCT_CHANGE_24H'
  | 'RSI_OVERSOLD'
  | 'RSI_OVERBOUGHT'
  | 'SMA_CROSS_BULLISH'
  | 'BREAKOUT_RESISTANCE'
  | 'VOLATILITY_SPIKE';

export interface AlertRule {
  id: string;
  instrumentId: string;
  instrumentTicker: string;
  brokerCode?: string;
  ruleType: AlertRuleType;
  horizon: TimeHorizon;
  thresholdValue: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cooldownMinutes: number;
  isActive: boolean;
  lastTriggeredAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  signalId?: string;
  alertRuleId?: string;
  instrumentId?: string;
  instrumentTicker?: string;
  horizon?: TimeHorizon;
  title: string;
  body: string;
  channel: 'WEB_PUSH' | 'IN_APP';
  deliveryStatus: 'SENT' | 'DELIVERED' | 'FAILED' | 'READ' | 'SUPPRESSED_QUIET_HOURS';
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  providerSource: string;
  observedTimestamp: string;
  sentAt: string;
  readAt?: string;
  quantitativeDetails?: {
    signalStatus?: SignalStatus;
    invalidationLevel?: number | null;
    interestLevel?: number | null;
    rationale?: string;
    risks?: string[];
  };
}

/**
 * 11. Portafoglio Manuale e Contabilità Precisa
 */
export type PortfolioTransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'COUPON'
  | 'FEE'
  | 'DEPOSIT'
  | 'WITHDRAWAL';

export interface PortfolioTransaction {
  id: string;
  instrumentId?: string;
  instrumentTicker?: string;
  transactionType: PortfolioTransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  currency: string;
  fxRateToBase: number; // Tasso di conversione verso valuta base (es. EUR)
  fxSource: string;
  fxObservedAt: string;
  declaredBrokerCode: string;
  executedAt: string;
  notes?: string;
}

export interface PortfolioPositionSummary {
  instrumentId: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  declaredBrokerCode: string;
  quantity: number;
  averageCostPrice: number;
  costCurrency: string;
  totalCostBasisInBase: number;
  currentMarketPrice: number | null;
  quoteCurrency: string;
  quoteProvider: string | null;
  quoteTimestamp: string | null;
  quoteFreshness: FreshnessStatus | 'UNAVAILABLE';
  fxRateToBase: number;
  fxSource: string;
  fxTimestamp: string;
  estimatedMarketValueInBase: number | null;
  unrealizedPnlInBase: number | null;
  unrealizedPnlPct: number | null;
  realizedPnlInBase: number;
  dividendsReceivedInBase: number;
  totalFeesPaidInBase: number;
  allocationWeightPct: number;
  valuationComplete: boolean;
}

export interface PortfolioAnalyticsSummary {
  baseCurrency: string;
  cashBalanceInBase: number;
  totalInvestedCostInBase: number;
  estimatedMarketValueInBase: number;
  totalPortfolioEquityInBase: number;
  unrealizedPnlInBase: number;
  unrealizedPnlPct: number;
  realizedPnlInBase: number;
  totalDividendsInBase: number;
  totalFeesPaidInBase: number;
  isValuationComplete: boolean;
  incompletePositionsCount: number;
  fxRatesUsed: Record<string, { rate: number; source: string; date: string }>;
  concentrationRisk: {
    herfindahlIndex: number; // 0..10000
    topPositionWeightPct: number;
    topPositionTicker: string | null;
    concentrationLevel: 'LOW' | 'MODERATE' | 'HIGH_CONCENTRATION_RISK';
    warnings: string[];
  };
  assetClassAllocation: { assetClass: AssetClass; valueInBase: number; weightPct: number }[];
  currencyExposure: { currency: string; valueInBase: number; weightPct: number }[];
  positions: PortfolioPositionSummary[];
}

/**
 * 12. Paper Trading e Strategy Backtesting
 */
export interface PaperOrder {
  id: string;
  instrumentId: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  referenceMarketPrice: number;
  simulatedExecutionPrice: number;
  simulatedSpreadCost: number;
  simulatedSlippageCost: number;
  simulatedCommission: number;
  realizedPnl: number | null;
  currency: string;
  quoteProviderId: string;
  quoteTimestamp: string;
  rationaleNotes?: string;
  executedAt: string;
}

export interface PaperPosition {
  instrumentId: string;
  ticker: string;
  name: string;
  quantity: number;
  averageEntryPrice: number;
  currency: string;
  currentPrice: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PaperAccountState {
  name: string;
  baseCurrency: string;
  initialCapital: number;
  cashBalance: number;
  defaultSpreadBps: number;
  defaultSlippageBps: number;
  defaultCommissionPct: number;
  orders: PaperOrder[];
  positions: PaperPosition[];
  realizedPnlTotal: number;
  unrealizedPnlTotal: number;
  totalEquity: number;
  maxDrawdownPct: number;
}

export interface BacktestTrade {
  entryTime: string;
  exitTime: string;
  side: 'LONG';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  totalCosts: number;
  netPnl: number;
  returnPct: number;
  sampleSegment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE';
  exitReason: string;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  strategyName: string;
  strategyVersion: string;
  instrumentId: string;
  instrumentTicker: string;
  providerId: string;
  timeframe: CandleTimeframe;
  startDate: string;
  endDate: string;
  candlesCount: number;
  initialCapital: number;
  finalEquity: number;
  commissionPct: number;
  spreadBps: number;
  slippageBps: number;
  maxRiskPerTradePct: number;
  totalReturnPct: number;
  benchmarkBuyHoldReturnPct: number;
  totalTrades: number;
  winRatePct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  riskRewardRatio: number;
  inSampleReturnPct: number;
  outOfSampleReturnPct: number;
  inSampleSplitDate: string;
  antiBiasChecks: {
    closedCandlesOnly: boolean;
    nextBarOpenExecution: boolean;
    inSampleOutOfSampleSeparated: boolean;
    costsAndSlippageApplied: boolean;
  };
  equityCurve: { time: string; strategyEquity: number; benchmarkEquity: number; segment: 'IN_SAMPLE' | 'OUT_OF_SAMPLE' }[];
  trades: BacktestTrade[];
  createdAt: string;
}

/**
 * 13. Provider Health & Scheduler Status
 */
export interface ProviderHealthInfo {
  id: 'coingecko' | 'twelvedata' | 'alphavantage' | 'fred' | 'ecb_frankfurter' | 'gemini';
  displayName: string;
  category: 'MARKET_DATA' | 'FX_RATES' | 'MACRO' | 'AI_ENGINE';
  status: ProviderStatus;
  hasCredentials: boolean;
  credentialsSource: 'ENV_BACKEND' | 'RUNTIME_BACKEND' | 'PUBLIC_OFFICIAL_NO_KEY' | 'SANDBOX_DEMO_KEY' | 'MISSING';
  lastSuccessAt: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  knownRateLimits: string;
  callsToday: number;
  dailyBudgetLimit: number;
  dataQualityStatus: 'HIGH' | 'DELAYED_PUBLIC' | 'SANDBOX_LIMITED' | 'UNAVAILABLE';
  availableFeatures: string[];
  suspendedFeatures: string[];
}

export interface SchedulerStatusInfo {
  isRunning: boolean;
  mode: 'ACTIVE_BACKEND_CRON' | 'SUSPENDED';
  intervalSeconds: number;
  lastRunAt: string | null;
  nextScheduledRunAt: string | null;
  dailyApiBudget: number;
  dailyApiCallsUsed: number;
  recentRuns: {
    id: string;
    startedAt: string;
    completedAt: string;
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED_BUDGET';
    instrumentsChecked: number;
    signalsGenerated: number;
    notificationsSent: number;
    apiCallsUsed: number;
  }[];
}

/**
 * 14. DemInvest AI Assistant & Tool Execution Logs
 */
export interface AIToolCallLog {
  id: string;
  toolName:
    | 'get_market_quote'
    | 'get_asset_metadata'
    | 'get_historical_candles'
    | 'calculate_technical_indicators'
    | 'get_portfolio_summary'
    | 'get_signal_history'
    | 'compare_assets'
    | 'calculate_scenario'
    | 'get_verified_market_news'
    | 'detect_market_regime'
    | 'scan_market_opportunities'
    | 'evaluate_strategy_setup'
    | 'assess_signal_risk'
    | 'simulate_position_risk'
    | 'get_recent_backtest_summary';
  inputParams: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  executionMs: number;
  status: 'SUCCESS' | 'ERROR' | 'BLOCKED_UNAUTHORIZED';
  executedAt: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  engineMode: 'GEMINI_LLM_TOOL_VERIFIED' | 'DETERMINISTIC_TOOL_ANALYST';
  structuredSections?: {
    verifiedData: string[];
    quantitativeCalculations: string[];
    technicalInterpretations: string[];
    hypothesesAndScenarios: string[];
    limitationsAndSources: string[];
  };
  toolCalls: AIToolCallLog[];
  sources: { provider: string; timestamp: string; description: string }[];
}

/**
 * 15. Profilo Utente & Preferenze
 */
export interface UserProfileAndPreferences {
  id: string;
  email: string;
  displayName: string;
  isOwner: boolean;
  onboardingCompleted: boolean;
  uiMode: UIMode;
  theme: ThemeMode;
  dataExecutionMode: DataExecutionMode;
  preferredCurrency: 'EUR' | 'USD' | 'GBP' | 'CHF';
  timezone: string;
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'QUANT';
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'DYNAMIC';
  investmentGoals: string[];
  preferredHorizons: TimeHorizon[];
  preferredMarkets: AssetClass[];
  selectedBrokers: string[];
  quietHoursStart: string;
  quietHoursEnd: string;
  maxDailyNotifications: number;
  createdAt: string;
}

/**
 * 16. Diagnostica e Riconciliazione Supabase Cloud
 */
export interface SupabaseSyncDiagnostics {
  configuredUrl: string;
  hasAnonOrPublishableKey: boolean;
  hasServiceRoleKey: boolean;
  connectionStatus:
    | 'CONNECTED'
    | 'MISSING_CREDENTIALS'
    | 'AUTH_ERROR'
    | 'SCHEMA_INCOMPLETE'
    | 'NETWORK_ERROR';
  authUserStatus:
    | 'PRESENT_IN_AUTH_USERS'
    | 'NOT_FOUND_IN_AUTH_USERS'
    | 'EMAIL_UNCONFIRMED'
    | 'NOT_CHECKED_NO_KEY';
  profileStatus:
    | 'PRESENT_IN_PROFILES'
    | 'MISSING_IN_PROFILES'
    | 'RECONCILED'
    | 'NOT_CHECKED';
  lastSyncAt: string | null;
  lastError: string | null;
  remoteTableCounts: {
    profiles: number;
    user_preferences: number;
    watchlists: number;
    portfolios: number;
    portfolio_transactions: number;
    alert_rules: number;
    instruments: number;
    application_settings: number;
  };
  syncStepsLog: {
    step: string;
    status: 'OK' | 'WARN' | 'ERROR';
    detail: string;
    timestamp: string;
  }[];
}

/**
 * 17. Market Regime Detector (Separazione Regime Direzionale vs Regime di Volatilità)
 */
export type DirectionalMarketRegime =
  | 'BULLISH_TREND'
  | 'BEARISH_TREND'
  | 'SIDEWAYS'
  | 'UNCERTAIN';

export type VolatilityMarketRegime =
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'NORMAL_VOLATILITY';

export interface MarketRegimeAnalysis {
  instrumentId: string;
  timeframe: CandleTimeframe;
  evaluatedAt: string;
  directionalRegime: DirectionalMarketRegime;
  volatilityRegime: VolatilityMarketRegime;
  regimeConfidenceScore: number; // 0..100 euristico
  adxStrengthLabel: 'STRONG_TREND' | 'MODERATE_TREND' | 'WEAK_OR_ABSENT';
  maAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'MIXED';
  atrExpansionRatio: number | null;
  bollingerState: 'SQUEEZE' | 'EXPANSION' | 'NORMAL';
  compatibleStrategies: string[];
  incompatibleStrategies: string[];
  explanation: string;
}

/**
 * 18. Multi-Timeframe Intelligence & Consenso Orizzonti
 */
export type MultiTimeframeConsensusState =
  | 'CONCORDANT_BULLISH'
  | 'CONCORDANT_BEARISH'
  | 'CONFLICTING_TRENDS'
  | 'CONFIRMED_BY_HIGHER_TF'
  | 'UNCONFIRMED_BY_HIGHER_TF'
  | 'UNCERTAIN_SCENARIO';

export interface MultiTimeframeConsensus {
  instrumentId: string;
  horizon: TimeHorizon;
  operationalTimeframe: CandleTimeframe;
  higherConfirmationTimeframe: CandleTimeframe;
  operationalTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'INSUFFICIENT_DATA';
  higherTrend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'INSUFFICIENT_DATA';
  operationalRegime: DirectionalMarketRegime;
  higherRegime: DirectionalMarketRegime;
  consensusState: MultiTimeframeConsensusState;
  convictionAdjustment: number; // da -25 a +20 punti euristici
  isHigherTimeframeAligned: boolean;
  summary: string;
}

/**
 * 19. Quantitative Strategy Engine (4 Strategie Deterministiche V1)
 */
export type StrategyIdV3 =
  | 'STRAT_TREND_FOLLOWING_V1'
  | 'STRAT_CONFIRMED_BREAKOUT_V1'
  | 'STRAT_PULLBACK_IN_TREND_V1'
  | 'STRAT_VOLATILITY_RISK_ALERT_V1';

export type SignalClassificationV3 =
  | 'BUY_SETUP'
  | 'SELL_SETUP'
  | 'EXIT_WARNING'
  | 'BULLISH_BREAKOUT'
  | 'BEARISH_BREAKDOWN'
  | 'MOMENTUM_CHANGE'
  | 'TREND_REVERSAL'
  | 'VOLATILITY_ALERT'
  | 'RISK_WARNING'
  | 'NO_TRADE';

export type SellSignalDistinction =
  | 'EXISTING_POSITION_EXIT'
  | 'BEARISH_MARKET_SIGNAL'
  | 'THEORETICAL_SHORT_SETUP'
  | 'NOT_APPLICABLE';

export interface QuantitativeStrategyDefinition {
  id: StrategyIdV3;
  name: string;
  version: string;
  supportedHorizons: TimeHorizon[];
  requiredTimeframes: CandleTimeframe[];
  minClosedCandles: number;
  requiredIndicators: string[];
  compatibleDirectionalRegimes: DirectionalMarketRegime[];
  compatibleVolatilityRegimes: VolatilityMarketRegime[];
  entryConditionsSummary: string[];
  exitOrAttentionConditionsSummary: string[];
  invalidationRulesSummary: string[];
  knownRisksAndFalsePositives: string[];
}

export interface StrategyEvaluationResult {
  strategyId: StrategyIdV3;
  strategyName: string;
  strategyVersion: string;
  instrumentId: string;
  instrumentTicker: string;
  horizon: TimeHorizon;
  timeframe: CandleTimeframe;
  evaluatedAt: string;
  isTriggered: boolean;
  signalClassification: SignalClassificationV3;
  legacySignalType: SignalType;
  signalStatus: SignalStatus;
  sellDistinction: SellSignalDistinction;
  referenceEntryZone: { min: number; max: number; ideal: number } | null;
  invalidationPrice: number | null;
  invalidationReason: string;
  targetLevels: { price: number; label: string; atrMultiple: number }[];
  conditionsMet: string[];
  conditionsUnmet: string[];
  heuristicScore: number;
  rationale: string;
  keyRisks: string[];
}

/**
 * 20. Risk Intelligence Engine & Simulatore Posizione
 */
export type RiskBandLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export interface RiskIntelligenceReport {
  instrumentId: string;
  instrumentTicker: string;
  evaluatedAt: string;
  overallRiskScore: number; // 0..100 (più alto = più rischioso)
  riskBand: RiskBandLevel;
  atrPct: number | null;
  annualizedVolatilityPct: number | null;
  recentMaxDrawdownPct: number | null;
  distanceToInvalidationPct: number | null;
  liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  fxRiskExposed: boolean;
  fxPairDescription: string;
  portfolioConcentrationImpactPct: number;
  overnightAndGapRisk: 'NONE_24X7' | 'MODERATE_INTRADAY' | 'HIGH_OVERNIGHT_WEEKEND_GAP';
  deterministicScenarios: {
    label: string;
    targetPrice: number;
    movePct: number;
    estimatedPnlPct: number;
  }[];
  riskWarnings: string[];
}

export interface PositionSimulationInput {
  instrumentId: string;
  capitalAllocatedInBase: number;
  entryPrice: number;
  invalidationStopPrice: number;
  targetPrices: number[];
  totalPortfolioEquityInBase: number;
  maxAcceptablePortfolioRiskPct: number;
  commissionPct: number;
  spreadBps: number;
  slippageBps: number;
  fxRateToBase?: number;
}

export interface PositionSimulationResult {
  instrumentId: string;
  entryPrice: number;
  invalidationStopPrice: number;
  positionUnits: number;
  grossExposureInBase: number;
  totalRoundtripCostsInBase: number;
  maxLossAtInvalidationInBase: number;
  maxLossPctOfPosition: number;
  portfolioCapitalAtRiskPct: number;
  maxAcceptablePortfolioRiskPct: number;
  exceedsMaxRiskThreshold: boolean;
  recommendedMaxPositionUnits: number;
  recommendedMaxCapitalInBase: number;
  targetsSimulation: {
    targetPrice: number;
    grossProfitInBase: number;
    netProfitInBase: number;
    netReturnPct: number;
    riskRewardRatio: number;
  }[];
  warnings: string[];
}

/**
 * 21. Opportunity Ranking Engine (Composito Ponderato con Penalità Collinearità)
 */
export interface OpportunityRankingItem {
  rank: number;
  instrumentId: string;
  instrumentTicker: string;
  instrumentName: string;
  assetClass: AssetClass;
  verifiedBrokerSymbol?: string;
  horizon: TimeHorizon;
  timeframe: CandleTimeframe;
  signalClassification: SignalClassificationV3;
  signalStatus: SignalStatus;
  sellDistinction: SellSignalDistinction;
  strategyId: StrategyIdV3;
  strategyName: string;
  compositeScore: number; // 0..100 qualità setup
  dataCompletenessScore: number; // 0..100 separato dalla qualità dell'opportunità
  weights: {
    trendCoherence: number;
    momentumConfirm: number;
    structureProximity: number;
    riskRewardQuality: number;
    multiTimeframeConfirm: number;
  };
  componentScores: {
    trendCoherence: number;
    momentumConfirm: number;
    structureProximity: number;
    riskRewardQuality: number;
    multiTimeframeConfirm: number;
  };
  collinearityPenaltyApplied: boolean;
  collinearityNotes: string;
  positiveDrivers: string[];
  negativeRiskFactors: string[];
  observedPrice: number;
  currency: string;
  referenceEntryZone: { min: number; max: number; ideal: number } | null;
  invalidationPrice: number | null;
  targetLevels: { price: number; label: string; atrMultiple: number }[];
  riskBand: RiskBandLevel;
  directionalRegime: DirectionalMarketRegime;
  volatilityRegime: VolatilityMarketRegime;
  multiTimeframeState: MultiTimeframeConsensusState;
}

/**
 * 22. Smart Market Scanner (Universo Configurabile & Risultati Strutturati)
 */
export interface MarketScanFilterParams {
  assetClasses?: AssetClass[];
  brokers?: string[];
  currencies?: string[];
  venues?: string[];
  horizon?: TimeHorizon;
  timeframe?: CandleTimeframe;
  regimeFilter?: DirectionalMarketRegime | 'ALL';
  volatilityFilter?: VolatilityMarketRegime | 'ALL';
  trendFilter?: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'ALL';
  rsiMin?: number;
  rsiMax?: number;
  minRelativeVolume?: number;
  nearSupportOrResistanceOnly?: boolean;
  breakoutOnly?: boolean;
  pullbackOnly?: boolean;
  minHeuristicScore?: number;
  maxRiskBand?: RiskBandLevel | 'ALL';
  excludeStaleData?: boolean;
  onlyWatchlistOrPortfolio?: boolean;
}

export interface AnalyzedInstrumentIntelligenceItem {
  instrumentId: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  venueMic: string;
  currency: string;
  priorityTier: 'WATCHLIST' | 'ACTIVE_ALERTS' | 'PORTFOLIO' | 'USER_SELECTED' | 'CATALOG';
  quote: MarketQuote;
  dataQuality: DataQualityAuditReport;
  indicators: QuantitativeIndicatorsSnapshot;
  regime: MarketRegimeAnalysis;
  multiTimeframe: MultiTimeframeConsensus;
  strategiesEvaluated: StrategyEvaluationResult[];
  bestStrategySetup: StrategyEvaluationResult;
  riskReport: RiskIntelligenceReport;
}

export interface MarketScanRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  executionMs: number;
  mode: DataExecutionMode;
  appliedFilters: MarketScanFilterParams;
  universeTotal: number;
  analyzedCount: number;
  excludedCount: number;
  coveragePct: number;
  excludedInstruments: {
    instrumentId: string;
    ticker: string;
    name: string;
    reasonCode:
      | 'INVALID_OR_STALE_DATA'
      | 'INSUFFICIENT_HISTORICAL_CANDLES'
      | 'FILTERED_OUT_BY_CRITERIA'
      | 'PROVIDER_UNAVAILABLE';
    detail: string;
  }[];
  analyzedInstruments: AnalyzedInstrumentIntelligenceItem[];
  detectedSetups: StrategyEvaluationResult[];
  riskAlerts: StrategyEvaluationResult[];
  topRankedOpportunities: OpportunityRankingItem[];
}


