-- ==============================================================================
-- DEMINVEST — INITIAL POSTGRESQL SCHEMA & ROW LEVEL SECURITY (0001)
-- ==============================================================================
-- Regole progettuali:
-- 1. Tutti gli importi monetari, prezzi e quantità usano NUMERIC(28, 10) o
--    NUMERIC(20, 6) per precisione contabile (MAI FLOAT/REAL per contabilità).
-- 2. Tutti i timestamp sono TIMESTAMPTZ (UTC).
-- 3. Row Level Security (RLS) abilitata su tutte le tabelle.
-- 4. Protezione SINGLE_USER_MODE tramite trigger database su profiles.
-- 5. Immutabilità retroattiva dei segnali storici (solo transizioni di stato).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 0. SYSTEM SETTINGS & SINGLE_USER_MODE ENFORCEMENT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.application_settings (key, value, description)
VALUES
  ('SINGLE_USER_MODE', 'true'::jsonb, 'Consente la registrazione solo al primo proprietario autorizzato'),
  ('DAILY_API_CALL_BUDGET', '500'::jsonb, 'Budget massimo giornaliero di chiamate verso provider esterni')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 1. IDENTITÀ (PROFILES, USER_PREFERENCES, USER_BROKERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger che garantisce SINGLE_USER_MODE a livello PostgreSQL
CREATE OR REPLACE FUNCTION public.enforce_single_user_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  single_mode BOOLEAN;
  existing_count INTEGER;
BEGIN
  SELECT (value::text = 'true') INTO single_mode
  FROM public.application_settings
  WHERE key = 'SINGLE_USER_MODE';

  SELECT COUNT(*) INTO existing_count FROM public.profiles;

  IF COALESCE(single_mode, TRUE) AND existing_count >= 1 THEN
    RAISE EXCEPTION 'SINGLE_USER_MODE attiva: DemInvest è configurata per uso personale esclusivo del proprietario.';
  END IF;

  IF existing_count = 0 THEN
    NEW.is_owner := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_user_mode ON public.profiles;
CREATE TRIGGER trg_enforce_single_user_mode
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_user_mode();

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ui_mode TEXT NOT NULL DEFAULT 'SIMPLE' CHECK (ui_mode IN ('SIMPLE', 'PRO')),
  theme TEXT NOT NULL DEFAULT 'DARK' CHECK (theme IN ('DARK', 'LIGHT')),
  language TEXT NOT NULL DEFAULT 'it-IT',
  preferred_currency TEXT NOT NULL DEFAULT 'EUR',
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  experience_level TEXT NOT NULL DEFAULT 'INTERMEDIATE' CHECK (experience_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'QUANT')),
  risk_tolerance TEXT NOT NULL DEFAULT 'MODERATE' CHECK (risk_tolerance IN ('CONSERVATIVE', 'MODERATE', 'DYNAMIC')),
  investment_goals TEXT[] NOT NULL DEFAULT ARRAY['CAPITAL_GROWTH', 'RISK_CONTROL'],
  preferred_horizons TEXT[] NOT NULL DEFAULT ARRAY['BREVE', 'MEDIO', 'LUNGO'],
  preferred_markets TEXT[] NOT NULL DEFAULT ARRAY['CRYPTO', 'EQUITY', 'ETF'],
  quiet_hours_start TEXT DEFAULT '22:30',
  quiet_hours_end TEXT DEFAULT '07:30',
  max_daily_notifications INTEGER NOT NULL DEFAULT 15,
  horizon_config JSONB NOT NULL DEFAULT '{
    "BREVISSIMO": {"minHours": 0.25, "maxHours": 24, "maxDataDelaySeconds": 120},
    "BREVE": {"minDays": 1, "maxDays": 30, "maxDataDelaySeconds": 3600},
    "MEDIO": {"minMonths": 1, "maxMonths": 12, "maxDataDelaySeconds": 86400},
    "LUNGO": {"minMonths": 12, "maxMonths": 120, "maxDataDelaySeconds": 86400}
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker_code TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('BROKER', 'TERMINAL', 'EXCHANGE', 'BANK_PLATFORM')),
  default_currency TEXT NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, broker_code)
);

-- ------------------------------------------------------------------------------
-- 2. MERCATI & UNIVERSAL INSTRUMENT REGISTRY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_data_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIGURED' CHECK (status IN ('UNCONFIGURED', 'CONFIGURED', 'TESTED', 'OPERATIONAL', 'OPERATIONAL_SANDBOX', 'SUSPENDED', 'ERROR')),
  has_credentials BOOLEAN NOT NULL DEFAULT FALSE,
  supports_realtime BOOLEAN NOT NULL DEFAULT FALSE,
  supported_asset_classes TEXT[] NOT NULL DEFAULT '{}',
  daily_limit INTEGER,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trading_venues (
  mic_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  timezone TEXT NOT NULL,
  currency TEXT NOT NULL,
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  is_24_7 BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.assets (
  id TEXT PRIMARY KEY,
  canonical_symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('EQUITY', 'ETF', 'CRYPTO', 'INDEX', 'FOREX', 'BOND', 'COMMODITY', 'DERIVATIVE')),
  isin TEXT,
  coingecko_id TEXT,
  issuer_name TEXT,
  blockchain TEXT,
  network TEXT,
  contract_address TEXT,
  decimals INTEGER,
  base_currency TEXT NOT NULL,
  sector TEXT,
  country TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_class ON public.assets(asset_class);
CREATE INDEX IF NOT EXISTS idx_assets_isin ON public.assets(isin) WHERE isin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_coingecko ON public.assets(coingecko_id) WHERE coingecko_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.instruments (
  id TEXT PRIMARY KEY,
  underlying_asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  instrument_type TEXT NOT NULL CHECK (instrument_type IN ('SPOT_CRYPTO', 'CASH_EQUITY', 'UCITS_ETF', 'US_ETF', 'SPOT_FOREX', 'INDEX_SPOT', 'BOND_GOVT', 'COMMODITY_SPOT', 'CFD', 'FUTURE')),
  ticker TEXT NOT NULL,
  venue_mic TEXT REFERENCES public.trading_venues(mic_code),
  quote_currency TEXT NOT NULL,
  base_asset_symbol TEXT,
  quote_asset_symbol TEXT,
  is_derivative BOOLEAN NOT NULL DEFAULT FALSE,
  primary_provider_id TEXT NOT NULL REFERENCES public.market_data_providers(id),
  provider_symbol TEXT NOT NULL,
  secondary_provider_symbol TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (primary_provider_id, provider_symbol, quote_currency)
);

CREATE TABLE IF NOT EXISTS public.broker_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  underlying_asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  broker_code TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('BROKER', 'TERMINAL', 'EXCHANGE')),
  broker_symbol TEXT NOT NULL,
  broker_instrument_name TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('SPOT', 'CASH_SHARE', 'ETF_SHARE', 'CFD', 'PERPETUAL', 'FUTURE')),
  currency TEXT NOT NULL,
  venue_label TEXT,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED', 'USER_CONFIRMED', 'UNVERIFIED')),
  verification_source TEXT NOT NULL,
  max_leverage NUMERIC(10, 2),
  contract_size NUMERIC(20, 6),
  tick_size NUMERIC(20, 8),
  tick_value NUMERIC(20, 8),
  typical_spread_bps NUMERIC(10, 2),
  commission_notes TEXT,
  trading_conditions_notes TEXT,
  spot_vs_derivative_warning TEXT,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (broker_code, broker_symbol, contract_type)
);

CREATE TABLE IF NOT EXISTS public.quotes (
  instrument_id TEXT PRIMARY KEY REFERENCES public.instruments(id) ON DELETE CASCADE,
  price NUMERIC(28, 10) NOT NULL,
  open_price NUMERIC(28, 10),
  high_price NUMERIC(28, 10),
  low_price NUMERIC(28, 10),
  previous_close NUMERIC(28, 10),
  change_abs NUMERIC(28, 10),
  change_pct NUMERIC(16, 6),
  volume_24h NUMERIC(28, 4),
  market_cap NUMERIC(28, 2),
  currency TEXT NOT NULL,
  provider_id TEXT NOT NULL REFERENCES public.market_data_providers(id),
  venue_mic TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  freshness_status TEXT NOT NULL CHECK (freshness_status IN ('REALTIME', 'DELAYED', 'EOD', 'STALE')),
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  validity_status TEXT NOT NULL CHECK (validity_status IN ('VALID', 'STALE', 'INCOMPLETE', 'SUSPENDED')),
  is_market_open BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.historical_candles (
  id BIGSERIAL PRIMARY KEY,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES public.market_data_providers(id),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('15m', '1h', '4h', '1d', '1w')),
  candle_time TIMESTAMPTZ NOT NULL,
  open NUMERIC(28, 10) NOT NULL,
  high NUMERIC(28, 10) NOT NULL,
  low NUMERIC(28, 10) NOT NULL,
  close NUMERIC(28, 10) NOT NULL,
  volume NUMERIC(28, 4) NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT TRUE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instrument_id, timeframe, provider_id, candle_time)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup
  ON public.historical_candles(instrument_id, timeframe, candle_time DESC);

CREATE TABLE IF NOT EXISTS public.data_quality_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id TEXT REFERENCES public.instruments(id) ON DELETE SET NULL,
  provider_id TEXT REFERENCES public.market_data_providers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('STALE_QUOTE', 'MISSING_CANDLES', 'OUTLIER_DETECTED', 'INCOMPLETE_CANDLE_EXCLUDED', 'RATE_LIMIT', 'PROVIDER_ERROR')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR')),
  details TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. MONITORAGGIO, SEGNALI E NOTIFICHE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  preferred_horizon TEXT NOT NULL DEFAULT 'BREVE',
  preferred_broker_code TEXT,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watchlist_id, instrument_id)
);

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  broker_code TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('PRICE_ABOVE', 'PRICE_BELOW', 'PCT_CHANGE_24H', 'RSI_OVERSOLD', 'RSI_OVERBOUGHT', 'SMA_CROSS_BULLISH', 'BREAKOUT_RESISTANCE', 'VOLATILITY_SPIKE')),
  horizon TEXT NOT NULL CHECK (horizon IN ('BREVISSIMO', 'BREVE', 'MEDIO', 'LUNGO')),
  threshold_value NUMERIC(28, 10),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.generated_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL REFERENCES public.assets(id),
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id),
  verified_broker_code TEXT,
  verified_broker_symbol TEXT,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY_SETUP', 'SELL_SETUP', 'BREAKOUT_ALERT', 'BREAKDOWN_ALERT', 'TREND_CHANGE', 'RISK_ALERT', 'PRICE_ALERT', 'EVENT_ALERT', 'NO_TRADE')),
  status TEXT NOT NULL CHECK (status IN ('DETECTED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'INVALIDATED', 'EXPIRED', 'CANCELLED')),
  horizon TEXT NOT NULL CHECK (horizon IN ('BREVISSIMO', 'BREVE', 'MEDIO', 'LUNGO')),
  timeframe TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  observed_price NUMERIC(28, 10) NOT NULL,
  currency TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  quote_observed_at TIMESTAMPTZ NOT NULL,
  quote_freshness TEXT NOT NULL,
  heuristic_score INTEGER NOT NULL CHECK (heuristic_score BETWEEN 0 AND 100),
  indicators_snapshot JSONB NOT NULL,
  conditions_met TEXT[] NOT NULL DEFAULT '{}',
  conditions_unmet TEXT[] NOT NULL DEFAULT '{}',
  interest_level NUMERIC(28, 10),
  invalidation_level NUMERIC(28, 10),
  scenario_targets NUMERIC(28, 10)[] NOT NULL DEFAULT '{}',
  key_risks TEXT[] NOT NULL DEFAULT '{}',
  quantitative_rationale TEXT NOT NULL,
  ai_explanation TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dedup_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signals_instrument_status
  ON public.generated_signals(instrument_id, status, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.signal_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.generated_signals(id) ON DELETE CASCADE,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluation_price NUMERIC(28, 10) NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  outcome_notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.generated_signals(id) ON DELETE SET NULL,
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('WEB_PUSH', 'IN_APP')),
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ', 'SUPPRESSED_QUIET_HOURS')),
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.scheduler_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED_BUDGET')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  instruments_checked INTEGER NOT NULL DEFAULT 0,
  signals_generated INTEGER NOT NULL DEFAULT 0,
  notifications_sent INTEGER NOT NULL DEFAULT 0,
  api_calls_used INTEGER NOT NULL DEFAULT 0,
  error_details TEXT
);

-- ------------------------------------------------------------------------------
-- 4. PATRIMONIO & PORTAFOGLIO MANUALE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  cash_balance NUMERIC(28, 10) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.portfolio_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  instrument_id TEXT REFERENCES public.instruments(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'DIVIDEND', 'COUPON', 'FEE', 'DEPOSIT', 'WITHDRAWAL')),
  quantity NUMERIC(28, 10) NOT NULL DEFAULT 0,
  unit_price NUMERIC(28, 10) NOT NULL DEFAULT 0,
  fees NUMERIC(28, 10) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  fx_rate_to_base NUMERIC(20, 8) NOT NULL DEFAULT 1,
  fx_source TEXT NOT NULL DEFAULT 'ECB_FRANKFURTER',
  fx_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  declared_broker_code TEXT,
  executed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.portfolio_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  quantity NUMERIC(28, 10) NOT NULL,
  average_cost_price NUMERIC(28, 10) NOT NULL,
  total_cost_basis NUMERIC(28, 10) NOT NULL,
  realized_pnl NUMERIC(28, 10) NOT NULL DEFAULT 0,
  dividends_received NUMERIC(28, 10) NOT NULL DEFAULT 0,
  total_fees_paid NUMERIC(28, 10) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  declared_broker_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, instrument_id, declared_broker_code)
);

-- ------------------------------------------------------------------------------
-- 5. SIMULAZIONE (PAPER TRADING, STRATEGIES, BACKTEST, JOURNAL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.paper_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Conto Simulazione Paper Trading',
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  initial_capital NUMERIC(28, 10) NOT NULL DEFAULT 10000,
  cash_balance NUMERIC(28, 10) NOT NULL DEFAULT 10000,
  default_spread_bps NUMERIC(10, 2) NOT NULL DEFAULT 15,
  default_slippage_bps NUMERIC(10, 2) NOT NULL DEFAULT 10,
  default_commission_pct NUMERIC(10, 4) NOT NULL DEFAULT 0.10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.paper_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_account_id UUID NOT NULL REFERENCES public.paper_accounts(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity NUMERIC(28, 10) NOT NULL,
  reference_market_price NUMERIC(28, 10) NOT NULL,
  simulated_execution_price NUMERIC(28, 10) NOT NULL,
  simulated_spread_cost NUMERIC(28, 10) NOT NULL,
  simulated_slippage_cost NUMERIC(28, 10) NOT NULL,
  simulated_commission NUMERIC(28, 10) NOT NULL,
  realized_pnl NUMERIC(28, 10),
  currency TEXT NOT NULL,
  quote_provider_id TEXT NOT NULL,
  quote_timestamp TIMESTAMPTZ NOT NULL,
  rationale_notes TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.paper_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_account_id UUID NOT NULL REFERENCES public.paper_accounts(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  quantity NUMERIC(28, 10) NOT NULL,
  average_entry_price NUMERIC(28, 10) NOT NULL,
  currency TEXT NOT NULL,
  stop_loss NUMERIC(28, 10),
  take_profit NUMERIC(28, 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (paper_account_id, instrument_id)
);

CREATE TABLE IF NOT EXISTS public.strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  horizon TEXT NOT NULL,
  description TEXT NOT NULL,
  rules_definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.backtest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strategy_id TEXT NOT NULL REFERENCES public.strategies(id),
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id),
  timeframe TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  initial_capital NUMERIC(28, 10) NOT NULL,
  commission_pct NUMERIC(10, 4) NOT NULL,
  spread_bps NUMERIC(10, 2) NOT NULL,
  slippage_bps NUMERIC(10, 2) NOT NULL,
  total_return_pct NUMERIC(16, 4) NOT NULL,
  benchmark_return_pct NUMERIC(16, 4) NOT NULL,
  total_trades INTEGER NOT NULL,
  win_rate_pct NUMERIC(10, 2) NOT NULL,
  profit_factor NUMERIC(16, 4) NOT NULL,
  max_drawdown_pct NUMERIC(16, 4) NOT NULL,
  risk_reward_ratio NUMERIC(16, 4) NOT NULL,
  in_sample_return_pct NUMERIC(16, 4) NOT NULL,
  out_of_sample_return_pct NUMERIC(16, 4) NOT NULL,
  trades_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trading_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_id TEXT REFERENCES public.instruments(id),
  title TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  outcome_review TEXT,
  emotional_state TEXT,
  lessons_learned TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. DEMINVEST AI CONVERSATIONS & TOOL AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context_instrument_id TEXT REFERENCES public.instruments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_tool_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  input_params JSONB NOT NULL,
  output_summary JSONB NOT NULL,
  execution_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR', 'BLOCKED_UNAUTHORIZED')),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. AUDIT LOGS, PROVIDER USAGE & SYSTEM HEALTH
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_usage (
  provider_id TEXT NOT NULL REFERENCES public.market_data_providers(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_count INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, usage_date)
);

CREATE TABLE IF NOT EXISTS public.system_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'SUSPENDED', 'ERROR')),
  message TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies per il proprietario autenticato (auth.uid() = user_id / id)
CREATE POLICY "Owner full access to profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Owner full access to preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to brokers" ON public.user_brokers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to watchlists" ON public.watchlists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to watchlist_items" ON public.watchlist_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid())
  );

CREATE POLICY "Owner full access to alert_rules" ON public.alert_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to notification_subscriptions" ON public.notification_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to notification_deliveries" ON public.notification_deliveries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to portfolios" ON public.portfolios
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to portfolio_transactions" ON public.portfolio_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Owner full access to portfolio_positions" ON public.portfolio_positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.portfolios p WHERE p.id = portfolio_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Owner full access to paper_accounts" ON public.paper_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to paper_orders" ON public.paper_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.paper_accounts pa WHERE pa.id = paper_account_id AND pa.user_id = auth.uid())
  );

CREATE POLICY "Owner full access to paper_positions" ON public.paper_positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.paper_accounts pa WHERE pa.id = paper_account_id AND pa.user_id = auth.uid())
  );

CREATE POLICY "Owner full access to backtest_runs" ON public.backtest_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to trading_journal_entries" ON public.trading_journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to ai_conversations" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner full access to ai_messages" ON public.ai_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Owner read access to ai_tool_execution_logs" ON public.ai_tool_execution_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owner read access to audit_logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. CLOUD RUNTIME STATE STORE (SUPABASE <-> CLOUDFLARE PAGES FUNCTIONS SYNC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_state_store (
  id TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_state_store ENABLE ROW LEVEL SECURITY;
-- Nessuna policy pubblica su app_state_store: accessibile esclusivamente dal backend
-- autorizzato tramite SUPABASE_SERVICE_ROLE_KEY (che bypassa RLS in modo sicuro lato server).

