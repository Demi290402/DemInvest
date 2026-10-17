# DATABASE.md — Progettazione Database PostgreSQL & Row Level Security

Lo schema completo è versionato in `supabase/migrations/0001_initial_schema.sql`.

## 1. Precisione Numerica Contabile e Timestamp
- Tutte le colonne monetarie, di prezzo e di quantità utilizzano `NUMERIC(28, 10)` o `NUMERIC(20, 6)` per impedire errori di arrotondamento in virgola mobile (`FLOAT`/`REAL` non sono mai utilizzati per contabilità).
- Tutti i riferimenti temporali sono memorizzati in `TIMESTAMPTZ` (UTC).

## 2. Tabelle Principali per Dominio

### Identità e Sicurezza
- `application_settings`: Parametri globali tra cui `SINGLE_USER_MODE` e `DAILY_API_CALL_BUDGET`.
- `profiles`: Profilo proprietario collegato a `auth.users(id)`, protetto dal trigger `trg_enforce_single_user_mode` che blocca la creazione di un secondo profilo quando `SINGLE_USER_MODE = true`.
- `user_preferences`: Modalità UI (`SIMPLE` / `PRO`), tema, valuta base, fuso orario, quiet hours, configurazione degli orizzonti temporali.
- `user_brokers`: Piattaforme e terminali dichiarati dall'utente.

### Mercati e Universal Instrument Registry
- `market_data_providers`: Stato operativo dei provider (`UNCONFIGURED`, `CONFIGURED`, `TESTED`, `OPERATIONAL`, `OPERATIONAL_SANDBOX`, `SUSPENDED`, `ERROR`).
- `trading_venues`: Borse e sedi di negoziazione identificate da codice `mic_code` (es. `XNGS`, `XNYS`, `XETR`, `MTAA`, `CRYPTO_GLOBAL`).
- `assets`: Sottostanti economici (`isin`, `coingecko_id`, `contract_address`, `blockchain`).
- `instruments`: Strumenti negoziabili collegati a `assets(id)` e distinti tra Spot/Cash e Derivati (`is_derivative`).
- `broker_instruments`: Mappatura specifica per broker con stato `verification_status` (`VERIFIED`, `USER_CONFIRMED`, `UNVERIFIED`), leva, spread e dimensione contratto.
- `quotes` e `historical_candles`: Serie storiche indicizzate su `(instrument_id, timeframe, candle_time DESC)`.
- `data_quality_events`: Log di anomalie, candele incomplete escluse o rate limit.

### Monitoraggio, Segnali e Notifiche
- `watchlists` e `watchlist_items`
- `alert_rules`: Regole deterministiche con `cooldown_minutes`.
- `generated_signals` e `signal_evaluations`: Registro immutabile dei segnali e delle transizioni di stato (`DETECTED`, `AWAITING_CONFIRMATION`, `CONFIRMED`, `INVALIDATED`, `EXPIRED`).
- `notification_subscriptions` e `notification_deliveries`: Sottoscrizioni Web Push VAPID e log di invio.
- `scheduler_runs`: Storico esecuzioni dei job pianificati.

### Patrimonio, Simulazione e AI
- `portfolios`, `portfolio_transactions`, `portfolio_positions`
- `paper_accounts`, `paper_orders`, `paper_positions`, `strategies`, `backtest_runs`, `trading_journal_entries`
- `ai_conversations`, `ai_messages`, `ai_tool_execution_logs`
- `audit_logs`, `provider_usage`, `system_health_events`

## 3. Row Level Security (RLS)
Tutte le tabelle contenenti dati personali, portafoglio, alert, simulazioni e conversazioni AI hanno `ENABLE ROW LEVEL SECURITY` con policy `auth.uid() = user_id`.
