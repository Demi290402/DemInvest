-- ==============================================================================
-- DEMINVEST — MIGRAZIONE INCREMENTALE 0003: ADVANCED MARKET INTELLIGENCE V3
-- ==============================================================================
-- Aggiunge le tabelle relazionali per Market Scanner, Market Regimes,
-- Strategy Versions, Signal Lifecycle Events, Risk Assessments e Opportunity Rankings
-- senza mai cancellare o sovrascrivere i dati esistenti.
-- ==============================================================================

-- 1. CATALOGO VERSIONATO DELLE STRATEGIE QUANTITATIVE (strategy_versions)
CREATE TABLE IF NOT EXISTS public.strategy_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  supported_horizons TEXT[] NOT NULL DEFAULT ARRAY['BREVE', 'MEDIO'],
  required_timeframes TEXT[] NOT NULL DEFAULT ARRAY['1h', '4h', '1d'],
  min_closed_candles INTEGER NOT NULL DEFAULT 30,
  required_indicators TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  compatible_directional_regimes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  compatible_volatility_regimes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  entry_conditions_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  exit_conditions_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  invalidation_rules_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  known_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Popolamento idempotente delle 4 strategie quantitative V1 (Sezione 8 Prompt 3)
INSERT INTO public.strategy_versions (
  id, name, version, supported_horizons, required_timeframes, min_closed_candles,
  required_indicators, compatible_directional_regimes, compatible_volatility_regimes
) VALUES
  (
    'STRAT_TREND_FOLLOWING_V1',
    'Trend Following Multi-EMA & ADX',
    '1.0.0',
    ARRAY['BREVE', 'MEDIO', 'LUNGO'],
    ARRAY['1h', '4h', '1d', '1w'],
    35,
    ARRAY['EMA 20', 'EMA 50', 'SMA 200', 'RSI 14', 'ADX 14'],
    ARRAY['BULLISH_TREND', 'BEARISH_TREND'],
    ARRAY['NORMAL_VOLATILITY', 'LOW_VOLATILITY']
  ),
  (
    'STRAT_CONFIRMED_BREAKOUT_V1',
    'Breakout di Resistenza Confermato',
    '1.0.0',
    ARRAY['BREVISSIMO', 'BREVE', 'MEDIO'],
    ARRAY['15m', '1h', '4h', '1d'],
    30,
    ARRAY['Pivot/Resistance Cluster', 'ATR 14', 'RSI 14', 'RVOL 20'],
    ARRAY['BULLISH_TREND', 'SIDEWAYS'],
    ARRAY['NORMAL_VOLATILITY', 'LOW_VOLATILITY', 'HIGH_VOLATILITY']
  ),
  (
    'STRAT_PULLBACK_IN_TREND_V1',
    'Pullback Controllato in Trend Rialzista',
    '1.0.0',
    ARRAY['BREVE', 'MEDIO'],
    ARRAY['1h', '4h', '1d'],
    35,
    ARRAY['EMA 20', 'SMA 50', 'RSI 14', 'Support Cluster', 'ATR 14'],
    ARRAY['BULLISH_TREND'],
    ARRAY['NORMAL_VOLATILITY', 'LOW_VOLATILITY']
  ),
  (
    'STRAT_VOLATILITY_RISK_ALERT_V1',
    'Alert di Rischio, Breakdown e Volatilità Anomala',
    '1.0.0',
    ARRAY['BREVISSIMO', 'BREVE', 'MEDIO', 'LUNGO'],
    ARRAY['15m', '1h', '4h', '1d', '1w'],
    20,
    ARRAY['ATR 14', 'True Range', 'Bollinger Bands 20/2', 'Drawdown %'],
    ARRAY['BEARISH_TREND', 'UNCERTAIN', 'SIDEWAYS', 'BULLISH_TREND'],
    ARRAY['HIGH_VOLATILITY', 'NORMAL_VOLATILITY']
  )
ON CONFLICT (id) DO NOTHING;

-- 2. ESECUZIONI DELLO SMART MARKET SCANNER (market_scan_runs)
CREATE TABLE IF NOT EXISTS public.market_scan_runs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  execution_mode TEXT NOT NULL DEFAULT 'LIVE',
  applied_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  universe_total INTEGER NOT NULL DEFAULT 0,
  analyzed_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  coverage_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  execution_ms INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RISULTATI DETTAGLIATI PER STRUMENTO DELLO SCANNER (market_scan_results)
CREATE TABLE IF NOT EXISTS public.market_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id TEXT NOT NULL REFERENCES public.market_scan_runs(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ANALYZED', 'EXCLUDED')),
  exclusion_reason_code TEXT,
  exclusion_detail TEXT,
  data_quality_classification TEXT,
  directional_regime TEXT,
  volatility_regime TEXT,
  multi_timeframe_state TEXT,
  best_strategy_id TEXT REFERENCES public.strategy_versions(id),
  signal_classification TEXT,
  heuristic_score INTEGER,
  risk_band TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. STORICO CLASSIFICAZIONE REGIMI DI MERCATO (market_regimes)
CREATE TABLE IF NOT EXISTS public.market_regimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  timeframe TEXT NOT NULL,
  directional_regime TEXT NOT NULL CHECK (directional_regime IN ('BULLISH_TREND', 'BEARISH_TREND', 'SIDEWAYS', 'UNCERTAIN')),
  volatility_regime TEXT NOT NULL CHECK (volatility_regime IN ('HIGH_VOLATILITY', 'LOW_VOLATILITY', 'NORMAL_VOLATILITY')),
  confidence_score INTEGER NOT NULL DEFAULT 50,
  adx_strength_label TEXT NOT NULL,
  ma_alignment TEXT NOT NULL,
  bollinger_state TEXT NOT NULL,
  compatible_strategies TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  explanation TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TRACCIAMENTO EVENTI DEL CICLO DI VITA DEI SEGNALI (signal_events)
CREATE TABLE IF NOT EXISTS public.signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  strategy_id TEXT REFERENCES public.strategy_versions(id),
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('DETECTED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'INVALIDATED', 'EXPIRED', 'CANCELLED')),
  signal_classification TEXT NOT NULL,
  sell_distinction TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  observed_price NUMERIC(24, 8) NOT NULL,
  invalidation_price NUMERIC(24, 8),
  reason TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VALUTAZIONI DI RISCHIO E SIMULAZIONI DI POSIZIONE (risk_assessments)
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score BETWEEN 0 AND 100),
  risk_band TEXT NOT NULL CHECK (risk_band IN ('LOW', 'MODERATE', 'HIGH', 'EXTREME')),
  atr_pct NUMERIC(10, 4),
  annualized_volatility_pct NUMERIC(10, 4),
  recent_max_drawdown_pct NUMERIC(10, 4),
  distance_to_invalidation_pct NUMERIC(10, 4),
  liquidity_risk TEXT NOT NULL,
  fx_risk_exposed BOOLEAN NOT NULL DEFAULT FALSE,
  overnight_gap_risk TEXT NOT NULL,
  simulation_payload JSONB DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. GRADUATORIA OPPORTUNITÀ PONDERATE (opportunity_rankings)
CREATE TABLE IF NOT EXISTS public.opportunity_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id TEXT REFERENCES public.market_scan_runs(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  horizon TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  strategy_id TEXT REFERENCES public.strategy_versions(id),
  signal_classification TEXT NOT NULL,
  composite_score INTEGER NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
  data_completeness_score INTEGER NOT NULL CHECK (data_completeness_score BETWEEN 0 AND 100),
  component_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  collinearity_penalty_applied BOOLEAN NOT NULL DEFAULT FALSE,
  positive_drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  negative_risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDICI PER PRESTAZIONI QUERY E AUDIT
CREATE INDEX IF NOT EXISTS idx_market_scan_results_run ON public.market_scan_results(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_market_regimes_inst_tf ON public.market_regimes(instrument_id, timeframe, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_events_inst ON public.signal_events(instrument_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_inst ON public.risk_assessments(instrument_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_rankings_score ON public.opportunity_rankings(composite_score DESC, created_at DESC);

-- ABILITAZIONE ROW LEVEL SECURITY (RLS) E POLICY
ALTER TABLE public.strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_scan_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_regimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_strategy_versions" ON public.strategy_versions;
CREATE POLICY "public_read_strategy_versions" ON public.strategy_versions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "auth_all_market_scan_runs" ON public.market_scan_runs;
CREATE POLICY "auth_all_market_scan_runs" ON public.market_scan_runs
  FOR ALL USING (auth.role() IN ('authenticated', 'anon', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'anon', 'service_role'));

DROP POLICY IF EXISTS "auth_all_market_scan_results" ON public.market_scan_results;
CREATE POLICY "auth_all_market_scan_results" ON public.market_scan_results
  FOR ALL USING (auth.role() IN ('authenticated', 'anon', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'anon', 'service_role'));

DROP POLICY IF EXISTS "auth_all_market_regimes" ON public.market_regimes;
CREATE POLICY "auth_all_market_regimes" ON public.market_regimes
  FOR ALL USING (auth.role() IN ('authenticated', 'anon', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'anon', 'service_role'));

DROP POLICY IF EXISTS "auth_all_signal_events" ON public.signal_events;
CREATE POLICY "auth_all_signal_events" ON public.signal_events
  FOR ALL USING (auth.role() IN ('authenticated', 'anon', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'anon', 'service_role'));

DROP POLICY IF EXISTS "auth_all_risk_assessments" ON public.risk_assessments;
CREATE POLICY "auth_all_risk_assessments" ON public.risk_assessments
  FOR ALL USING (auth.role() IN ('authenticated', 'anon', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'anon', 'service_role'));

DROP POLICY IF EXISTS "auth_all_opportunity_rankings" ON public.opportunity_rankings;
CREATE POLICY "auth_all_opportunity_rankings" ON public.opportunity_rankings
  FOR ALL USING (auth.role() IN ('authenticated', 'anon', 'service_role'))
  WITH CHECK (auth.role() IN ('authenticated', 'anon', 'service_role'));
