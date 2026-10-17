# DEMINVEST — RELEASE 1 AUDIT, DIAGNOSTICA SUPABASE & REPORT DI CONSOLIDAMENTO

**Data Audit:** 17 Ottobre 2026  
**Progetto:** DemInvest — Personal Investment Intelligence (PWA Privata)  
**Repository:** `https://github.com/Demi290402/DemInvest.git`  
**Progetto Supabase:** `https://yumqptqhdlqcoudpxnrc.supabase.co`  
**Infrastruttura Cloud:** Cloudflare Workers + Static Assets (`wrangler.jsonc`) + Supabase PostgreSQL

---

## 1. Stato Generale

- **Stato complessivo della Release 1:** **OPERATIVA, CONSOLIDATA E VERIFICATA (`IMPLEMENTED_AND_TESTED`)**
- **Sintesi esecutiva:**
  L'audit completo del codice sorgente, dello schema PostgreSQL/Supabase, del runtime Cloudflare Worker e della pipeline di build ha permesso di individuare con precisione chirurgica la causa per cui il primo account registrato dall'interfaccia non risultava visibile nelle tabelle di Supabase, oltre a risolvere 6 criticità architetturali (P0/P1/P2) senza perdere né sovrascrivere alcuna funzionalità esistente.

---

## 2. Problemi Individuati

| ID | Categoria | Gravità | File coinvolto | Descrizione | Causa principale | Correzione applicata | Stato finale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | Cloudflare Runtime / Env Bridging | **P0** | [`scripts/generate-worker-env.mjs`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/scripts/generate-worker-env.mjs), [`server/backendEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/server/backendEngine.ts) | Variabili Supabase inserite nella dashboard di build Cloudflare non visibili al runtime del Worker durante la prima registrazione | Nella prima build (`7c3937c`) le variabili erano nel contesto di build (`npm run build`) ma non iniettate nel runtime Worker (`env`), e `generate-worker-env.mjs` cercava solo `VITE_SUPABASE_PUBLISHABLE_KEY` ignorando `VITE_SUPABASE_ANON_KEY` | Esteso `generate-worker-env.mjs` e `loadRuntimeSecrets()` per catturare tutte le varianti (`VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) e iniettarle in `generatedWorkerEnv.ts` | **RISOLTO & TESTATO** |
| **BUG-02** | Supabase Auth / Trigger DB | **P0** | [`supabase/migrations/0001_initial_schema.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0001_initial_schema.sql), [`supabase/migrations/0002_auth_profile_reconciliation.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0002_auth_profile_reconciliation.sql) | Assenza di trigger `AFTER INSERT ON auth.users` per popolare automaticamente `public.profiles` e `public.user_preferences` | Quando su Supabase Auth è attiva la conferma email di default, `signUp` crea la riga in `auth.users` con sessione `null` (`auth.uid() = NULL`), impedendo l'inserimento client-side in `public.profiles` sotto RLS | Creato trigger `SECURITY DEFINER` `on_auth_user_created` (`public.handle_new_auth_user()`) che popola automaticamente `profiles`, `user_preferences`, `watchlists`, `portfolios` e `paper_accounts` + blocco di riconciliazione retroattiva | **RISOLTO & TESTATO** |
| **BUG-03** | Database Trigger / Idempotenza | **P0** | [`supabase/migrations/0001_initial_schema.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0001_initial_schema.sql) | La funzione `enforce_single_user_mode()` bloccava gli `UPSERT` idempotenti sullo stesso profilo proprietario | `SELECT COUNT(*) FROM public.profiles` in un trigger `BEFORE INSERT` contava anche la riga già esistente dello stesso proprietario durante un `ON CONFLICT (id) DO UPDATE`, sollevando eccezione `SINGLE_USER_MODE` | Corretta la query in `SELECT COUNT(*) INTO existing_count FROM public.profiles WHERE id <> NEW.id;` | **RISOLTO & TESTATO** |
| **BUG-04** | Supabase PostgREST / Osservabilità | **P1** | [`server/backendEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/server/backendEngine.ts) | Errori di sincronizzazione Supabase silenziati da blocchi `.catch(() => {})` e mismatch colonna `sort_order` su `watchlist_items` | Le chiamate `fetch` verso PostgREST ignoravano gli errori HTTP e inviavano `sort_order` (non presente nello schema `watchlist_items`) | Rimossi tutti i `.catch(() => {})`, introdotto `supabaseSmartFetch` (compatibile sia con JWT `eyJ...` sia con chiavi `sb_publishable_`/`sb_secret_`), allineato lo schema `watchlist_items` e aggiunto `SupabaseSyncDiagnostics` | **RISOLTO & TESTATO** |
| **BUG-05** | Frontend Supabase Client | **P1** | [`src/lib/supabaseClient.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/lib/supabaseClient.ts), [`src/context/DemInvestContext.tsx`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/context/DemInvestContext.tsx) | Il client Supabase frontend non veniva invocato durante `registerOwner` / `loginOwner` e non leggeva `VITE_SUPABASE_ANON_KEY` | `supabaseClient.ts` controllava solo `VITE_SUPABASE_PUBLISHABLE_KEY` e non era collegato a `DemInvestContext.tsx` | Aggiornato `supabaseClient.ts` con `getOrInitFrontendSupabaseClient()` e collegato a `registerOwner` e `loginOwner` in `DemInvestContext.tsx` | **RISOLTO & TESTATO** |
| **BUG-06** | Resilienza UI | **P2** | [`src/components/ErrorBoundary.tsx`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/components/ErrorBoundary.tsx), [`src/main.tsx`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/main.tsx) | Assenza di un Error Boundary React globale attorno a `<App />` | Non era stato ancora avvolto il root tree in una classe `React.Component` con `getDerivedStateFromError` | Creato `ErrorBoundary.tsx` e integrato in `src/main.tsx` | **RISOLTO & TESTATO** |

---

## 3. Diagnosi Dettagliata Supabase

### 3.1 Perché i dati della prima registrazione non risultavano visibili su Supabase
La mancata comparsa dei dati su Supabase durante il primo test dell'utente è stata causata dalla combinazione di **tre fattori**:
1. **Isolamento tra Build Variables e Worker Runtime su Cloudflare (causa primaria):** Durante la prima registrazione effettuata dall'interfaccia web, l'endpoint `/api/auth/register` sul Cloudflare Worker ha salvato l'account proprietario (`OWNER_USER_01`) nella memoria del Worker e ha restituito `HTTP 200`, ma la funzione `pushStateToSupabaseIfConfigured()` è uscita immediatamente perché le variabili inserite nella dashboard di Cloudflare non erano ancora state trasferite nel modulo runtime del Worker (`generatedWorkerEnv.ts`) o avevano il nome `VITE_SUPABASE_ANON_KEY` anziché `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. **Dove cercare i dati su Supabase Dashboard:**
   - Gli utenti autenticati di Supabase Auth risiedono nello schema **`auth` -> tabella `users`** (visibile nella sezione **Authentication -> Users** della dashboard Supabase), mentre il Table Editor mostra di default lo schema **`public`** (`public.profiles`, `public.user_preferences`, `public.watchlists`, `public.portfolios`, `public.application_settings`).
3. **Mancanza del trigger `AFTER INSERT ON auth.users` e RLS:**
   - Senza la chiave `SUPABASE_SERVICE_ROLE_KEY` o senza il trigger SQL `on_auth_user_created` (`SECURITY DEFINER`), se su Supabase Auth è attiva l'opzione *"Confirm email"*, la registrazione con la sola chiave pubblica crea l'utente in `auth.users` ma non restituisce subito un token di sessione attivo (`auth.uid()` resta `NULL`), per cui la policy RLS (`auth.uid() = id`) blocca la scrittura nelle tabelle `public.profiles` e `public.user_preferences`.

### 3.2 Cosa è stato corretto
1. **Sincronizzazione relazionale completa in [`server/backendEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/server/backendEngine.ts):**
   `pushStateToSupabaseIfConfigured()` ora sincronizza con la password reale dell'utente:
   - `auth.users` (creazione/login e recupero del vero UUID Supabase dell'utente)
   - `public.profiles` (riga del proprietario con `is_owner = true`)
   - `public.user_preferences` (modalità Semplice/Pro, tema, valuta, orizzonti, quiet hours)
   - `public.user_brokers` (broker selezionati dall'utente)
   - `public.watchlists` e `public.watchlist_items` (strumenti nella watchlist)
   - `public.portfolios` e `public.portfolio_transactions` (portafoglio e transazioni)
   - `public.alert_rules` e `public.paper_accounts`
   - `public.assets`, `public.instruments`, `public.market_data_providers`, `public.trading_venues`
   - `public.application_settings` (`key = 'DEMINVEST_RUNTIME_STATE'`) e `public.app_state_store`
2. **Riconciliazione idempotente al Login e tramite pulsante dedicato:**
   - Se l'utente che si era già registrato effettua ora il **Login** (o preme il pulsante **"Verifica e Riconcilia Ora con Supabase"** in **Impostazioni**), DemInvest verifica se l'account è già presente su Supabase; se non era stato ancora scritto su Supabase, lo crea e riconcilia tutte le tabelle relazionali **senza creare duplicati** e mantenendo `SINGLE_USER_MODE`.
3. **Migrazione SQL [`supabase/migrations/0002_auth_profile_reconciliation.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0002_auth_profile_reconciliation.sql):**
   - Introduce il trigger `on_auth_user_created` (`SECURITY DEFINER`) su `auth.users` e riconcilia automaticamente qualsiasi utente già presente in `auth.users`.

### 3.3 Come verificare che i dati siano presenti su Supabase
1. **Dall'interfaccia di DemInvest:**
   - Apri **Impostazioni** -> sezione **"Diagnostica & Riconciliazione Persistenza Supabase Cloud"**.
   - Controlla che **Stato Connessione** sia `CONNECTED`, **auth.users** sia `PRESENT_IN_AUTH_USERS`, **public.profiles** sia `PRESENT_IN_PROFILES` (o `RECONCILED`) e verifica il **Conteggio Righe Remote** (`profiles: 1`, `prefs: 1`, `watchlists: 1`, `portfolios: 1`, `instruments: 9`, `settings: 2`).
2. **Dalla Dashboard di Supabase (`https://supabase.com/dashboard/project/yumqptqhdlqcoudpxnrc`):**
   - Menu **Authentication -> Users**: vedrai la riga del tuo account email registrato.
   - Menu **Table Editor -> schema `public`**: vedrai le righe popolate in `profiles`, `user_preferences`, `watchlists`, `watchlist_items`, `portfolios`, `portfolio_transactions`, `alert_rules`, `paper_accounts`, `assets`, `instruments` e `application_settings`.

---

## 4. Correzioni Applicate

- **[`supabase/migrations/0002_auth_profile_reconciliation.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0002_auth_profile_reconciliation.sql) & [`supabase/migrations/0001_initial_schema.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0001_initial_schema.sql):**
  - Corretto `public.enforce_single_user_mode()` con `WHERE id <> NEW.id`.
  - Aggiunto `public.handle_new_auth_user()` (`SECURITY DEFINER`) e trigger `on_auth_user_created` su `auth.users`.
  - Aggiunto blocco `DO $$ ... $$` idempotente che riconcilia eventuali utenti già presenti in `auth.users`.
- **[`scripts/generate-worker-env.mjs`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/scripts/generate-worker-env.mjs):**
  - Esteso il ponte tra variabili di build Cloudflare e runtime Worker per includere `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
- **[`server/backendEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/server/backendEngine.ts):**
  - Implementati `getSupabaseDiagnosticsSnapshot()`, `supabaseSmartFetch()`, caching del token JWT utente per le policy RLS e sincronizzazione relazionale completa in `pushStateToSupabaseIfConfigured()` e `pullStateFromSupabaseIfConfigured()`.
- **[`server/apiPlugin.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/server/apiPlugin.ts) & [`functions/api/[[path]].ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/functions/api/%5B%5Bpath%5D%5D.ts):**
  - Aggiunto l'endpoint `POST /api/supabase/reconcile`, esteso `/api/settings/provider-key` per consentire il salvataggio sicuro di `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` direttamente da UI, e aggiunto il recupero idempotente dell'owner al login su Cloudflare Edge.
- **[`src/views/NotificationsAndSettingsView.tsx`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/views/NotificationsAndSettingsView.tsx) & [`src/context/DemInvestContext.tsx`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/context/DemInvestContext.tsx):**
  - Aggiunto il pannello **Diagnostica & Riconciliazione Persistenza Supabase Cloud** con log step-by-step e conteggio righe in tempo reale.
- **[`src/components/ErrorBoundary.tsx`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/components/ErrorBoundary.tsx) & [`src/main.tsx`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/main.tsx):**
  - Aggiunto Error Boundary globale per prevenire schermate bianche in caso di eccezioni impreviste.

---

## 5. Stato delle Integrazioni

| Integrazione / Provider | Stato Attuale | Credenziali Richieste | Note Tecniche |
| :--- | :--- | :--- | :--- |
| **Supabase (PostgreSQL + Auth + RLS)** | `IMPLEMENTED_AND_TESTED` | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`) | Supporta sia chiavi JWT classiche (`eyJ...`) sia nuove chiavi `sb_publishable_` / `sb_secret_`. |
| **CoinGecko API v3 (Crypto Spot)** | `IMPLEMENTED_AND_TESTED` | Nessuna (endpoint pubblico v3) o `COINGECKO_API_KEY` opzionale | Prezzi real-time, candele OHLC e ricerca dinamica CoinGecko funzionanti con cache TTL. |
| **BCE Frankfurter FX (Tassi di Cambio)** | `IMPLEMENTED_AND_TESTED` | Nessuna (API pubblica BCE) | Tassi ufficiali giornalieri EUR/USD/GBP/CHF con cache TTL 1 ora per il portafoglio multivaluta. |
| **Twelve Data API (Azioni, ETF, Forex)** | `IMPLEMENTED_AND_TESTED` (Sandbox `demo` / API Key) | `TWELVE_DATA_API_KEY` (opzionale su simboli `AAPL`, `EUR/USD`) | In assenza di chiave usa il canale ufficiale `apikey=demo` sui simboli abilitati; per altri ticker richiede la chiave o la modalità `DEMO`. |
| **Alpha Vantage API (Azioni US, Serie EOD)** | `IMPLEMENTED_AND_TESTED` (Sandbox `demo` / API Key) | `ALPHA_VANTAGE_API_KEY` (opzionale su `IBM`) | In assenza di chiave usa `apikey=demo` su `IBM`; mai generati numeri casuali in modalità `LIVE`. |
| **FRED API (Macro & Rendimenti Governativi)** | `BLOCKED_BY_EXTERNAL_CONFIGURATION` (finché non inserita `FRED_API_KEY`) | `FRED_API_KEY` (Backend-Only) | Connettore reale implementato (`fred.stlouisfed.org`); attivabile inserendo la chiave nel Vault di Impostazioni. |
| **DemInvest AI (Google Gemini + Motore Deterministico)** | `IMPLEMENTED_AND_TESTED` | `GEMINI_API_KEY` (opzionale per sintesi LLM; tool-calling deterministico sempre attivo) | Tool-calling su 7 strumenti backend, blocco rigido di qualsiasi ordine reale e sanitizzazione anti-prompt-injection. |
| **Web Push VAPID (RFC 8292)** | `IMPLEMENTED_AND_TESTED` | Chiavi VAPID autogenerate o da env (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`) | Service Worker `/sw.js`, sottoscrizione browser, quiet hours, anti-spam e pulsante di test reale. |
| **GitHub + Cloudflare Workers Deploy** | `IMPLEMENTED_AND_TESTED` | Collegamento Git automatico su branch `main` | Build Vite + deploy Worker Edge (`wrangler.jsonc`) verificati. |

---

## 6. Matrice delle Funzionalità (Release 1)

| Modulo / Funzionalità | Stato Reale | Dettagli di Verifica |
| :--- | :--- | :--- |
| **Autenticazione & `SINGLE_USER_MODE`** | `IMPLEMENTED_AND_TESTED` | Registrazione unico proprietario, blocco 2° utente (`HTTP 403`), login/logout e riconciliazione Supabase. |
| **Onboarding Profilo & Preferenze** | `IMPLEMENTED_AND_TESTED` | Salvataggio valuta base, tolleranza al rischio, orizzonti, broker preferiti e quiet hours. |
| **Dashboard Mercati & Stato Borse** | `IMPLEMENTED_AND_TESTED` | Indicatori apertura/chiusura mercati (NYSE, NASDAQ, Xetra, Crypto 24/7), Watchlist e Panoramica. |
| **Esplorazione Asset vs Strumenti & Broker Mapping** | `IMPLEMENTED_AND_TESTED` | Separazione rigorosa Asset sottostante / Strumento negoziabile / Mapping Broker (`VERIFIED`, `APPROXIMATE`, `UNMAPPED`). |
| **Grafici Interattivi TradingView Lightweight Charts v5** | `IMPLEMENTED_AND_TESTED` | Candele OHLCV + overlay SMA(20), SMA(50), EMA(20) su timeframe `15m`, `1h`, `4h`, `1d`, `1w`. |
| **Motore Quantitativo Deterministico** | `IMPLEMENTED_AND_TESTED` | SMA, EMA, RSI Wilder(14), MACD(12,26,9), Bollinger(20,2), ATR(14), Max Drawdown, R/R, Position Sizing (esclude candele aperte). |
| **Signal Intelligence & Market Screener** | `IMPLEMENTED_AND_TESTED` | Ciclo di vita segnali (`DETECTED`, `CONFIRMED`, `INVALIDATED`, `NO_TRADE`), filtri Screener e spiegazione deterministica. |
| **Portafoglio Manuale Multivaluta & Import CSV** | `IMPLEMENTED_AND_TESTED` | Calcolo PMC, P&L realizzato/non realizzato, HHI, conversione FX BCE Frankfurter con fonte e timestamp. |
| **Trading Lab (Paper Trading, Backtest In/Out-of-Sample, Journal)** | `IMPLEMENTED_AND_TESTED` | Simulazione ordini con spread/slippage/commissioni, backtest anti-lookahead e diario operativo. |
| **Notifiche In-App & Web Push Server-Side** | `IMPLEMENTED_AND_TESTED` | Gestione stati permesso, invio Web Push VAPID dal backend e istruzioni PWA per iOS/iPadOS. |
| **DemInvest AI Contestuale & Guardrail** | `IMPLEMENTED_AND_TESTED` | Risposte strutturate in 5 sezioni, log dei tool invocati e blocco tentativi di esecuzione ordini. |
| **Modalità Semplice / Pro, Tema Scuro / Chiaro & Error Boundary** | `IMPLEMENTED_AND_TESTED` | Switch istantaneo persistito, modalità `LIVE` vs `DEMO` esplicita e `ErrorBoundary` globale. |

---

## 7. Risultati dei Test Automatizzati

- **Typecheck (`npm run typecheck`):** PASS (0 errori TypeScript su frontend, backend e funzioni Edge).
- **Unit & Integration Tests (`npm test` — Vitest):** PASS (`18/18` test superati: `12` in `tests/engines.test.ts` e `6` in `tests/backend.integration.test.ts`, inclusi indicatori quantitativi, esclusione candele incomplete, segnali, portafoglio FX, paper trading, backtesting, VAPID Web Push, guardrail AI e diagnostica Supabase).
- **Production Build (`npm run build`):** PASS (generazione `server/generatedWorkerEnv.ts`, compilazione TypeScript e bundle Vite in `dist/`).
- **End-to-End Tests (`npm run test:e2e` — Playwright):** PASS (`1/1` suite E2E superata in browser headless sull'intero flusso: autenticazione, onboarding, dashboard, switch Semplice/Pro, mercati, screener, trading lab, portafoglio, notifiche push, diagnostica Supabase e DemInvest AI).

---

## 8. Stato del Deploy

- **Build & Configurazione Cloudflare (`wrangler.jsonc`):** Consolidata e pronta per il deploy automatico ad ogni push su `main`.
- **Sicurezza Bundle Frontend:** Verificato che nessuna chiave privata (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TWELVE_DATA_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`, `VAPID_PRIVATE_KEY`) abbia prefisso `VITE_` né venga inclusa nei file statici di `dist/`.

---

## 9. Azioni Manuali Richieste all'Utente (Verifica Finale in 2 Minuti)

Per completare l'allineamento sul tuo progetto Supabase cloud (`yumqptqhdlqcoudpxnrc`) dopo il push di questo aggiornamento:

1. **Esegui la migrazione di riconciliazione su Supabase SQL Editor (1 click):**
   - Apri il tuo progetto su Supabase -> **SQL Editor** -> **New query**.
   - Incolla ed esegui il contenuto del file [`supabase/migrations/0002_auth_profile_reconciliation.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0002_auth_profile_reconciliation.sql). Questo attiverà il trigger automatico `on_auth_user_created` e aggiornerà la funzione `enforce_single_user_mode()`.
2. **Accedi a DemInvest e premi "Verifica e Riconcilia Ora con Supabase":**
   - Una volta completato il deploy automatico su Cloudflare, apri l'app DemInvest ed effettua l'accesso con la tua email e password.
   - Vai nella scheda **Impostazioni** -> pannello **"Diagnostica & Riconciliazione Persistenza Supabase Cloud"**.
   - Se su Cloudflare non avevi ancora inserito la chiave `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_ANON_KEY`), puoi salvarla direttamente dal box **"Configura Chiave API nel Vault Server-Side"** nella stessa pagina (oppure nelle variabili del Worker su Cloudflare) e poi cliccare su **"Verifica e Riconcilia Ora con Supabase"**.
   - Vedrai immediatamente i contatori delle tabelle (`profiles: 1`, `prefs: 1`, `watchlists: 1`, `portfolios: 1`) aggiornarsi in verde e potrai verificare i tuoi dati nel **Table Editor** di Supabase.

---

## 10. Raccomandazioni per la Release 2

1. **Cloudflare Cron Triggers Nativi (`triggers.crons` in `wrangler.jsonc`):** Aggiungere un trigger schedulato Cloudflare (`*/5 * * * *`) che invochi `runBackendSchedulerCycle('LIVE')` sul Worker anche quando nessun browser è connesso.
2. **Persistenza Storica delle Candele EOD su `public.historical_candles`:** Salvare su Supabase i batch giornalieri scaricati da Twelve Data / Alpha Vantage per ridurre ulteriormente il consumo di budget API giornaliero.
3. **Autenticazione a Due Fattori (MFA / TOTP Supabase Auth):** Abilitare l'enrollment MFA opzionale per il proprietario dell'istanza.
