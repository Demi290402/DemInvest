-- ==============================================================================
-- DEMINVEST — MIGRAZIONE 0002: TRIGGER AUTO-PROFILO AUTH, IDEMPOTENZA UPSERT,
-- RICONCILIAZIONE UTENTI ESISTENTI E POLICY RLS COMPLETE
-- ==============================================================================
-- Obiettivi di questa migrazione (non distruttiva e 100% idempotente):
-- 1. Correggere `public.enforce_single_user_mode()` usando `WHERE id <> NEW.id`
--    così le operazioni di UPSERT (`ON CONFLICT (id) DO UPDATE`) sullo stesso
--    proprietario non vengono bloccate dal trigger BEFORE INSERT.
-- 2. Creare il trigger `on_auth_user_created` (`AFTER INSERT ON auth.users`) con
--    `SECURITY DEFINER` che popola automaticamente `public.profiles`,
--    `public.user_preferences`, `public.watchlists`, `public.portfolios` e
--    `public.paper_accounts` anche quando la conferma email è attiva.
-- 3. Riconciliare automaticamente eventuali utenti già registrati in `auth.users`
--    che non avevano ancora una riga in `public.profiles`.
-- 4. Garantire le policy RLS per cataloghi e tabelle utente.
-- ==============================================================================

-- 1. CORREZIONE IDEMPOTENTE DEL TRIGGER SINGLE_USER_MODE SU public.profiles
CREATE OR REPLACE FUNCTION public.enforce_single_user_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  single_mode BOOLEAN;
  other_users_count INTEGER;
BEGIN
  SELECT (value::text = 'true') INTO single_mode
  FROM public.application_settings
  WHERE key = 'SINGLE_USER_MODE';

  -- Conta solo eventuali ALTRI profili diversi da NEW.id (consente UPSERT idempotenti sul proprietario)
  SELECT COUNT(*) INTO other_users_count
  FROM public.profiles
  WHERE id <> NEW.id;

  IF COALESCE(single_mode, TRUE) AND other_users_count >= 1 THEN
    RAISE EXCEPTION 'SINGLE_USER_MODE attiva: DemInvest è configurata per uso personale esclusivo del proprietario.';
  END IF;

  IF other_users_count = 0 THEN
    NEW.is_owner := TRUE;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_user_mode ON public.profiles;
CREATE TRIGGER trg_enforce_single_user_mode
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_user_mode();

-- 2. FUNZIONE E TRIGGER SECURITY DEFINER SU auth.users PER CREAZIONE AUTOMATICA PROFILO
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
  v_other_count INTEGER;
  v_single_mode BOOLEAN;
BEGIN
  SELECT (value::text = 'true') INTO v_single_mode
  FROM public.application_settings
  WHERE key = 'SINGLE_USER_MODE';

  SELECT COUNT(*) INTO v_other_count
  FROM public.profiles
  WHERE id <> NEW.id;

  -- Se SINGLE_USER_MODE è attiva e c'è già un proprietario, non crea un secondo profilo
  IF COALESCE(v_single_mode, TRUE) AND v_other_count >= 1 THEN
    RETURN NEW;
  END IF;

  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(COALESCE(NEW.email, 'Proprietario'), '@', 1)
  );

  -- Inserimento idempotente in public.profiles
  INSERT INTO public.profiles (id, email, display_name, is_owner, onboarding_completed, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'owner@deminvest.local'),
    v_display_name,
    (v_other_count = 0),
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
      updated_at = NOW();

  -- Inserimento idempotente in public.user_preferences
  INSERT INTO public.user_preferences (
    user_id,
    ui_mode,
    theme,
    language,
    preferred_currency,
    timezone,
    experience_level,
    risk_tolerance,
    updated_at
  )
  VALUES (
    NEW.id,
    'SIMPLE',
    'DARK',
    'it-IT',
    'EUR',
    'Europe/Rome',
    'INTERMEDIATE',
    'MODERATE',
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Crea Watchlist predefinita se non esiste per l'utente
  IF NOT EXISTS (SELECT 1 FROM public.watchlists WHERE user_id = NEW.id) THEN
    INSERT INTO public.watchlists (user_id, name, is_default)
    VALUES (NEW.id, 'Watchlist Principale', TRUE);
  END IF;

  -- Crea Portafoglio principale se non esiste per l'utente
  IF NOT EXISTS (SELECT 1 FROM public.portfolios WHERE user_id = NEW.id) THEN
    INSERT INTO public.portfolios (user_id, name, base_currency, cash_balance)
    VALUES (NEW.id, 'Portafoglio Personale DemInvest', 'EUR', 15000);
  END IF;

  -- Crea Conto Paper Trading predefinito se non esiste per l'utente
  IF NOT EXISTS (SELECT 1 FROM public.paper_accounts WHERE user_id = NEW.id) THEN
    INSERT INTO public.paper_accounts (user_id, name, base_currency, initial_capital, cash_balance)
    VALUES (NEW.id, 'Conto Paper Trading DemInvest (Virtuale)', 'USD', 25000, 25000);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. RICONCILIAZIONE AUTOMATICA DEGLI UTENTI GIÀ REGISTRATI IN auth.users PRIVI DI PROFILO
DO $$
DECLARE
  r_user RECORD;
  v_display_name TEXT;
BEGIN
  FOR r_user IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
    ORDER BY u.created_at ASC
    LIMIT 1
  LOOP
    v_display_name := COALESCE(
      r_user.raw_user_meta_data->>'display_name',
      r_user.raw_user_meta_data->>'full_name',
      split_part(COALESCE(r_user.email, 'Proprietario'), '@', 1)
    );

    INSERT INTO public.profiles (id, email, display_name, is_owner, onboarding_completed, created_at, updated_at)
    VALUES (r_user.id, COALESCE(r_user.email, 'owner@deminvest.local'), v_display_name, TRUE, FALSE, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_preferences (user_id, ui_mode, theme, language, preferred_currency, timezone)
    VALUES (r_user.id, 'SIMPLE', 'DARK', 'it-IT', 'EUR', 'Europe/Rome')
    ON CONFLICT (user_id) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM public.watchlists WHERE user_id = r_user.id) THEN
      INSERT INTO public.watchlists (user_id, name, is_default)
      VALUES (r_user.id, 'Watchlist Principale', TRUE);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.portfolios WHERE user_id = r_user.id) THEN
      INSERT INTO public.portfolios (user_id, name, base_currency, cash_balance)
      VALUES (r_user.id, 'Portafoglio Personale DemInvest', 'EUR', 15000);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.paper_accounts WHERE user_id = r_user.id) THEN
      INSERT INTO public.paper_accounts (user_id, name, base_currency, initial_capital, cash_balance)
      VALUES (r_user.id, 'Conto Paper Trading DemInvest (Virtuale)', 'USD', 25000, 25000);
    END IF;
  END LOOP;
END;
$$;

-- 4. ASSICURA L'ESISTENZA DI public.app_state_store E POLICY PER IL PROPRIETARIO AUTENTICATO
CREATE TABLE IF NOT EXISTS public.app_state_store (
  id TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_state_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated owner access to app_state_store" ON public.app_state_store;
CREATE POLICY "Authenticated owner access to app_state_store" ON public.app_state_store
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_owner = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_owner = TRUE)
  );

-- Consenti agli utenti autenticati di inserire/leggere i propri log AI e segnali
DROP POLICY IF EXISTS "Owner insert access to ai_tool_execution_logs" ON public.ai_tool_execution_logs;
CREATE POLICY "Owner insert access to ai_tool_execution_logs" ON public.ai_tool_execution_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner insert access to audit_logs" ON public.audit_logs;
CREATE POLICY "Owner insert access to audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
