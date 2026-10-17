# DEMINVEST — MARKET INTELLIGENCE, QUANTITATIVE RESEARCH & SMART SIGNALS REPORT (V3)

**Data generazione:** 2026-10-17  
**Branch di sviluppo:** `feature/market-intelligence-v3` (sincronizzato su `main`)  
**Progetto Supabase Cloud:** `https://yumqptqhdlqcoudpxnrc.supabase.co`

---

## A. Architettura del Motore Finanziario (Market Intelligence V3)

Il nucleo quantitativo di DemInvest V3 è stato progettato secondo un'architettura modulare a 6 livelli deterministici indipendenti dall'LLM:

1. **Data Quality & Validation Fail-Safe Layer** (`auditMarketDataQuality` in [`src/engines/quantitativeEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/engines/quantitativeEngine.ts)):
   - Verifica prezzi positivi, coerenza OHLC (`High >= max(Open, Close)`, `Low <= min(Open, Close)`, `High >= Low`), assenza di timestamp duplicati o futuri, ordine cronologico crescente, esclusione tassativa delle candele ancora in formazione (`isClosed === false`) e rilevamento di salti anomali su singola barra (>38% Equity/ETF, >65% Crypto) indicativi di split non rettificati o dati sporchi.
   - Classifica ogni serie come `VALID`, `DELAYED`, `STALE`, `INCOMPLETE`, `INVALID` o `UNAVAILABLE` e blocca automaticamente la generazione di segnali operativi se `blockingSignalGeneration === true`.
2. **Quantitative Analysis Engine V3** (`computeQuantitativeSnapshot` in [`src/engines/quantitativeEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/engines/quantitativeEngine.ts)):
   - Calcola medie mobili semplici ed esponenziali (`SMA 20/50/100/200`, `EMA 9/12/20/26/50/200`), pendenza normalizzata (`sma20SlopeNormalizedPct`, `ema20SlopeNormalizedPct`, `ema50SlopeNormalizedPct`), `ADX(14)` di Wilder con componenti direzionali `+DI(14)` e `-DI(14)`, `RSI(14)`, `MACD(12,26,9)`, `ROC(10)`, `Momentum(10)`, `Stochastic(14,3)`, `ATR(14)` assoluto e percentuale, `Bollinger Bands(20,2)` (`Upper`, `Middle`, `Lower`, `%B`, `Bandwidth`), volatilità storica annualizzata, `Max Drawdown` e `Current Drawdown from Peak`.
   - Rileva **Pivot High / Pivot Low confermati senza look-ahead bias** (`detectConfirmedPivots`): un pivot formatosi alla candela $i$ (`pivotCandleTime`) viene confermato solo alla chiusura della candela $i + \text{rightBars}$ (`confirmedAtCandleTime`), tracciando rotture (`broken`) e falsi breakout (`falseBreakoutDetected`).
3. **Market Regime Detector & Multi-Timeframe Consensus** (`detectMarketRegime`, `evaluateMultiTimeframeConsensus` in [`src/engines/marketIntelligenceEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/engines/marketIntelligenceEngine.ts)):
   - Separa rigorosamente il **Regime Direzionale** (`BULLISH_TREND`, `BEARISH_TREND`, `SIDEWAYS`, `UNCERTAIN`) dal **Regime di Volatilità** (`LOW_VOLATILITY`, `NORMAL_VOLATILITY`, `HIGH_VOLATILITY`).
   - Valuta la coerenza tra il timeframe operativo e il timeframe superiore di conferma (`CONCORDANT_BULLISH`, `CONCORDANT_BEARISH`, `CONFLICTING_TRENDS`, `CONFIRMED_BY_HIGHER_TF`, `UNCONFIRMED_BY_HIGHER_TF`, `UNCERTAIN_SCENARIO`).
4. **Quantitative Strategy Engine V3** (`evaluateAllStrategiesForInstrument` in [`src/engines/marketIntelligenceEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/engines/marketIntelligenceEngine.ts)):
   - Esegue 4 strategie versionate (`v1.0.0`) con regole di attivazione, invalidazione, target multipli in ATR e distinzione esplicita dei segnali ribassisti (`EXISTING_POSITION_EXIT` vs `BEARISH_MARKET_SIGNAL` vs `THEORETICAL_SHORT_SETUP`).
5. **Risk Intelligence & Interactive Position Simulator** (`evaluateRiskIntelligence`, `simulatePositionRisk` in [`src/engines/marketIntelligenceEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/engines/marketIntelligenceEngine.ts)):
   - Calcola rischio complessivo (`0–100`), fascia di rischio (`LOW`, `MODERATE`, `HIGH`, `EXTREME`), rischio cambio FX, rischio gap overnight/weekend e simulazione interattiva di position sizing comprensiva di spread, slippage e commissioni.
6. **Smart Market Scanner & Opportunity Ranking Engine** (`runSmartMarketScanner`, `rankMarketOpportunities` in [`src/engines/marketIntelligenceEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/src/engines/marketIntelligenceEngine.ts)):
   - Analizza l'universo secondo la coda di priorità (`PORTFOLIO` → `ACTIVE_ALERTS` → `WATCHLIST` → `CATALOG`), applica 18 filtri multiparametro e calcola un punteggio composito `0–100` con penalizzazione di collinearità tra indicatori ridondanti e punteggio separato di completezza dati (`dataCompletenessScore`).

---

## B. Provider Dati Utilizzati e Relativa Copertura

| Provider | Asset Class Coperte | Freschezza Dati | Credenziali Richieste | Stato Fall-Safe |
| :--- | :--- | :--- | :--- | :--- |
| **CoinGecko API v3** | Crypto Spot (`BTC`, `ETH`, `SOL`, `LINK`, catalogo dinamico) | `REALTIME` / `DELAYED` (~30–60s) | Pubblico ufficiale (Opzionale Pro Key) | Operativo di default |
| **BCE / Frankfurter FX** | Tassi di cambio ufficiali (`EUR`, `USD`, `GBP`, `CHF`) | `EOD` giornaliero BCE | Pubblico ufficiale senza chiave | Operativo di default |
| **Twelve Data API** | Azioni (`AAPL`, `NVDA`), ETF (`VWCE`, `CSPX`), Forex (`EUR/USD`), CFD | `REALTIME` / `DELAYED` | `TWELVE_DATA_API_KEY` | Sospensione trasparente in modalità `LIVE` se chiave assente |
| **Alpha Vantage API** | Azioni & ETF USA/EU (serie storiche OHLCV di backup) | `DELAYED` / `EOD` | `ALPHA_VANTAGE_API_KEY` | Fallback secondario verificato |
| **FRED (St. Louis Fed)** | Serie Macroeconomiche e Rendimenti Obbligazionari | `EOD` | `FRED_API_KEY` | Configurabile da Impostazioni |

---

## C. Elenco degli Indicatori Implementati e Formule

1. **SMA ($N$):** $\text{SMA}_N = \frac{1}{N}\sum_{i=0}^{N-1} C_{t-i}$ per $N \in \{20, 50, 100, 200\}$.
2. **EMA ($N$):** $\text{EMA}_t = C_t \cdot k + \text{EMA}_{t-1} \cdot (1 - k)$ con $k = \frac{2}{N+1}$ per $N \in \{9, 12, 20, 26, 50, 200\}$.
3. **Slope Normalizzata (% per barra):** $\text{Slope}_{L} = \frac{\text{MA}_t - \text{MA}_{t-L}}{L \cdot \text{MA}_{t-L}} \times 100$.
4. **RSI (Wilder 14):** Media mobile smussata di Wilder dei guadagni $U$ e delle perdite $D$ su 14 candele chiuse: $\text{RSI} = 100 - \frac{100}{1 + U_{14}/D_{14}}$.
5. **MACD (12, 26, 9):** $\text{MACD} = \text{EMA}_{12} - \text{EMA}_{26}$, $\text{Signal} = \text{EMA}_9(\text{MACD})$, $\text{Histogram} = \text{MACD} - \text{Signal}$.
6. **ROC (10) & Momentum (10):** $\text{ROC}_{10} = \frac{C_t - C_{t-10}}{C_{t-10}} \times 100$, $\text{Mom}_{10} = C_t - C_{t-10}$.
7. **Stochastic (14, 3):** $\%K = \frac{C_t - L_{14}}{H_{14} - L_{14}} \times 100$, $\%D = \text{SMA}_3(\%K)$.
8. **True Range & ATR (Wilder 14):** $\text{TR}_t = \max(H_t - L_t, |H_t - C_{t-1}|, |L_t - C_{t-1}|)$, $\text{ATR}\% = \frac{\text{ATR}_{14}}{C_t} \times 100$.
9. **ADX (Wilder 14) + DI:** Calcolo di $+\text{DM}$, $-\text{DM}$ smussati su 14 periodi per ottenere $+\text{DI}_{14}$, $-\text{DI}_{14}$, $\text{DX}$ e $\text{ADX}_{14}$.
10. **Bollinger Bands (20, 2):** $\text{Middle} = \text{SMA}_{20}$, $\text{Upper/Lower} = \text{SMA}_{20} \pm 2\sigma_{20}$, $\text{Bandwidth}\% = \frac{\text{Upper}-\text{Lower}}{\text{Middle}}\times 100$, $\%B = \frac{C_t - \text{Lower}}{\text{Upper}-\text{Lower}}$.
11. **Volatilità Storica Annualizzata:** Deviazione standard dei rendimenti logaritmici $\ln(C_t / C_{t-1})$ moltiplicata per $\sqrt{365}$ (Crypto 24/7) o $\sqrt{252}$ (Mercati borsistici).
12. **Max Drawdown & Current Drawdown:** $\text{MDD}\% = \max_{t} \left(\frac{\text{Peak}_t - C_t}{\text{Peak}_t}\right) \times 100$.
13. **Supporti/Resistenze Frattali ATR & Pivot Confermati:** Clusterizzazione dei massimi/minimi locali confermati dopo $N_R = 2$ candele chiuse successive entro una banda di tolleranza $0.75 \times \text{ATR}_{14}$.

---

## D. Strategie Implementate e Regole Complete

1. **`STRAT_TREND_FOLLOWING_V1` (v1.0.0) — Trend Following Multi-Media & Momentum:**
   - *Orizzonti:* `BREVE`, `MEDIO`, `LUNGO` | *Minimo candele chiuse:* 50.
   - *Ingresso Long (`BUY_SETUP`):* Regime `BULLISH_TREND`, `Prezzo > EMA20 > EMA50`, `ADX(14) >= 20`, `RSI(14)` tra 48 e 68, `MACD Histogram >= 0`, consenso multi-timeframe non conflittuale.
   - *Uscita / Segnale Ribassista:* Perdita di `EMA20` e `SMA50` con `MACD Histogram < 0` o regime `BEARISH_TREND`. Distingue `EXISTING_POSITION_EXIT` (se lo strumento è in portafoglio) da `BEARISH_MARKET_SIGNAL`.
   - *Invalidazione:* $\min(\text{Supporto S1}, \text{EMA}_{50} - 1.2 \times \text{ATR}_{14})$.
2. **`STRAT_CONFIRMED_BREAKOUT_V1` (v1.0.0) — Breakout Strutturale Confermato con Espansione:**
   - *Orizzonti:* `BREVISSIMO`, `BREVE`, `MEDIO` | *Minimo candele chiuse:* 30.
   - *Attivazione (`BULLISH_BREAKOUT` / `BEARISH_BREAKDOWN`):* Chiusura candela oltre resistenza/supporto statico o pivot confermato, accompagnata da `True Range >= 1.15x ATR(14)` e `Relative Volume >= 1.2x` (quando il volume del provider è disponibile).
   - *Invalidazione:* Rientro sotto il livello rotto oltre $0.8 \times \text{ATR}_{14}$ (falso breakout).
3. **`STRAT_PULLBACK_IN_TREND_V1` (v1.0.0) — Pullback Controllato su Supporto Dinamico:**
   - *Orizzonti:* `BREVE`, `MEDIO` | *Minimo candele chiuse:* 50.
   - *Attivazione (`BUY_SETUP`):* Trend primario rialzista (`SMA50` positiva, `Prezzo > SMA50`), ritracciamento verso `EMA20`/`SMA20` o supporto statico entro $1.0 \times \text{ATR}_{14}$, `RSI(14)` scarico ma sopra 40 (`40–55`), tenuta del supporto.
   - *Invalidazione:* Chiusura sotto `SMA50` o sotto il minimo dell'ultimo Pivot Low confermato ($-1.0 \times \text{ATR}_{14}$).
4. **`STRAT_VOLATILITY_RISK_ALERT_V1` (v1.0.0) — Alert di Volatilità Estrema e Deterioramento Rischio:**
   - *Orizzonti:* `BREVISSIMO`, `BREVE`, `MEDIO`, `LUNGO` | *Minimo candele chiuse:* 20.
   - *Attivazione (`VOLATILITY_ALERT` / `RISK_WARNING`):* `ATR% >= 4.5%`, `True Range >= 1.8x ATR(14)`, `Max Drawdown >= 15%` o compressione estrema delle Bande di Bollinger (`Bandwidth < 4%`).

---

## E. Logica del Market Regime Detector

Il modulo `detectMarketRegime` valuta separatamente:
- **Regime Direzionale (`directionalRegime`):**
  - `BULLISH_TREND`: Allineamento rialzista delle medie (`Close > SMA20 > SMA50`), pendenza `SMA20 > 0` e `ADX(14) >= 20` (o struttura di massimi/minimi crescenti).
  - `BEARISH_TREND`: Allineamento ribassista (`Close < SMA20 < SMA50`), pendenza `SMA20 < 0` e `ADX(14) >= 20`.
  - `SIDEWAYS`: `ADX(14) < 20` e oscillazione contenuta attorno alla media centrale.
  - `UNCERTAIN`: Dati insufficienti o segnali tecnici divergenti ad alta entropia.
- **Regime di Volatilità (`volatilityRegime`):**
  - `HIGH_VOLATILITY`: `ATR% >= 3.8%` o `Volatilità Annualizzata >= 55%` o `Bollinger Bandwidth >= 18%`.
  - `LOW_VOLATILITY`: `ATR% <= 1.1%` o `Bollinger Squeeze` (`Bandwidth <= 5%`).
  - `NORMAL_VOLATILITY`: Parametri intermedi regolari.

---

## F. Logica di Analisi Multi-Orizzonte e Multi-Timeframe

La matrice `HORIZON_PROFILES_V3` associa a ogni orizzonte:
- `BREVISSIMO`: Timeframe primario `15m`/`1h`, conferma superiore `4h`, ritardo massimo tollerato `90s` (blocco tassativo su dati `DELAYED`/`EOD`).
- `BREVE`: Timeframe primario `1d` (o `4h`), conferma superiore `1w`, durata tipica `1–30 giorni`.
- `MEDIO`: Timeframe primario `1d`, conferma superiore `1w`, durata tipica `1–12 mesi`.
- `LUNGO`: Timeframe primario `1w`, conferma superiore `1w` + struttura `SMA200` e drawdown storico, durata `> 12 mesi`.

---

## G. Logica di Generazione, Conferma, Scadenza e Invalidazione dei Segnali

Ogni segnale attraversa stati formali (`NEW` → `CONFIRMED` → `WEAKENING` → `INVALIDATED` / `EXPIRED`):
- **Generazione:** Richiede superamento del controllo Fail-Safe dati e attivazione deterministica di almeno una strategia.
- **Invalidazione automatica (`INVALIDATED`):** Scatta immediatamente quando il prezzo osservato viola `invalidationLevel` / `invalidationPrice`.
- **Scadenza temporale (`EXPIRED`):** Ogni orizzonte assegna una finestra di validità (`expiresAt`); superata tale data il segnale passa a `EXPIRED`.

---

## H. Logica di Risk Intelligence e Simulazione Posizione

Il simulatore `simulatePositionRisk` riceve capitale allocato, prezzo di ingresso, stop di invalidazione, target, valore totale del portafoglio, budget di rischio % massimo e costi di transazione (spread in bps, slippage in bps, commissioni %):
- Calcola le unità acquistabili (`positionUnits`), i costi totali roundtrip (`totalRoundtripCostsInBase`), la perdita massima all'invalidazione inclusiva dei costi (`maxLossAtInvalidationInBase`) e l'incidenza sul portafoglio (`portfolioCapitalAtRiskPct`).
- Se `portfolioCapitalAtRiskPct > maxAcceptablePortfolioRiskPct`, segnala `exceedsMaxRiskThreshold = true` e calcola il capitale e le unità massime consigliate (`recommendedMaxCapitalInBase`, `recommendedMaxPositionUnits`).

---

## I. Logica di Ranking delle Opportunità

Il motore `rankMarketOpportunities` ordina i setup tramite una media ponderata trasparente `0–100`:
- Coerenza del Trend (`25%`)
- Conferma del Momentum (`20%`)
- Prossimità Strutturale e Volumetrica (`20%`)
- Qualità del Rapporto Rischio/Rendimento (`20%`)
- Conferma Multi-Timeframe (`15%`)
- **Penalità di Collinearità:** Se RSI, MACD e ROC sono simultaneamente in estremo, applica una decurtazione di `-6 punti` (`collinearityPenaltyApplied = true`) per evitare il doppio conteggio della stessa spinta di momentum.
- **Separazione Qualità Dati:** Il punteggio di completezza dati (`dataCompletenessScore`) è esposto separatamente e non gonfia artificialmente la qualità tecnica del setup.

---

## J. Funzionamento dello Smart Market Scanner

Lo scanner (`runSmartMarketScanner` / `POST /api/intelligence/scan`) ordina gli strumenti per priorità (`PORTFOLIO`, `ACTIVE_ALERTS`, `WATCHLIST`, `CATALOG`), esegue il controllo qualità dati e restituisce:
- `analyzedInstruments`: scheda completa con indicatori, regime, consenso MTF, 4 strategie valutate e report di rischio.
- `excludedInstruments`: elenco trasparente degli strumenti esclusi con codice motivo (`PROVIDER_UNAVAILABLE`, `INVALID_OR_STALE_DATA`, `INSUFFICIENT_HISTORICAL_CANDLES`, `FILTERED_OUT_BY_CRITERIA`).
- `topRankedOpportunities`: graduatoria ordinata per `compositeScore`.

---

## K. Funzionamento del Sistema di Alert e Notifiche

- Deduplicazione tramite hash deterministico `buildSignalDedupHash` su finestra mobile di 120 minuti.
- Cooldown configurabile per singola regola di alert (`cooldownMinutes`).
- Protezione **Quiet Hours** (`22:30–07:30` Europe/Rome): le notifiche non critiche vengono registrate come `SUPPRESSED_QUIET_HOURS` senza disturbare l'utente.
- Web Push RFC 8292 con chiavi crittografiche VAPID persistenti e rimozione automatica delle subscription scadute (`404`/`410`).

---

## L. Integrazione dell'Assistente DemInvest AI con i Tool Quantitativi

In [`server/backendEngine.ts`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/server/backendEngine.ts), `processContextualAiChat` esegue esclusivamente tool backend verificati (`get_market_quote`, `calculate_technical_indicators`, `detect_market_regime`, `evaluate_strategy_setup`, `get_portfolio_summary`, `calculate_scenario`) registrando ogni chiamata in `ai_tool_execution_logs`. L'LLM non inventa mai prezzi o indicatori e struttura ogni risposta in 5 sezioni verificabili (*Dati Verificati*, *Calcoli Quantitativi*, *Interpretazioni Tecniche*, *Ipotesi e Scenari di Rischio*, *Limitazioni e Fonti*).

---

## M. Tabelle e Migrazioni Database Aggiunte o Aggiornate

La migrazione incrementale [`supabase/migrations/0003_market_intelligence_v3.sql`](file:///c:/Users/cistu/.gemini/antigravity/scratch/DemInvest/supabase/migrations/0003_market_intelligence_v3.sql) aggiunge:
1. `public.strategy_versions` (catalogo strategie quantitative versionate e seed delle 4 strategie V1)
2. `public.market_scan_runs` (storico esecuzioni Smart Market Scanner)
3. `public.market_scan_results` (risultati per singolo strumento analizzato o escluso)
4. `public.market_regimes` (storico regimi direzionali e di volatilità rilevati)
5. `public.signal_events` (audit log transizioni ciclo di vita segnali e distinzione `sell_distinction`)
6. `public.risk_assessments` (valutazioni di rischio e simulazioni posizione)
7. `public.opportunity_rankings` (graduatorie multifattoriali con pesi, componenti e penalità di collinearità)

Tutte le tabelle sono protette da **Row Level Security (RLS)** e indici sulle chiavi di ricerca.

---

## N. Test Eseguiti e Risultati

- **Typecheck (`npm run typecheck`):** `0 errori` TypeScript su intero progetto frontend, backend e Cloudflare Worker.
- **Unit & Integration Tests (`npm test` — Vitest):** Tutti i test su indicatori, Data Quality Fail-Safe, Pivot senza look-ahead bias, Market Regime Detector, Multi-Timeframe Consensus, 4 Strategie V3, distinzione segnali di vendita, Simulatore Posizione, Smart Scanner, Backtesting V3 e diagnostica Supabase superati al 100%.
- **End-to-End Tests (`npm run test:e2e` — Playwright):** Verifica completa del flusso utente reale inclusi Login/Registrazione, Market Regime V3, Smart Market Scanner V3, Simulatore Interattivo di Posizione, Riconciliazione Supabase e DemInvest AI.

---

## O. Limitazioni Note dei Provider Gratuiti e Raccomandazioni

1. **Copertura Live Strumenti Azionari/ETF/Forex:** Senza la configurazione di `TWELVE_DATA_API_KEY` o `ALPHA_VANTAGE_API_KEY`, in modalità `LIVE` gli strumenti azionari ed ETF vengono esclusi in modo trasparente dallo scanner (`PROVIDER_UNAVAILABLE`), mentre le criptovalute Spot (`CoinGecko API v3`) e i cambi ufficiali (`BCE Frankfurter`) operano in tempo reale senza necessità di chiavi. In modalità `DEMO`, l'intero catalogo multi-asset è sempre analizzabile a scopo didattico.
2. **Sincronizzazione Utenti su Supabase Cloud (`auth.users` & `public.profiles`):** Assicurarsi di aver incollato la chiave `SUPABASE_ANON_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`) nel riquadro di accesso o nella vista **Impostazioni → Stato Connessione & Riconciliazione Supabase Cloud**, così che sia il browser sia il Worker Cloudflare possano registrare e sincronizzare l'utente proprietario su `https://yumqptqhdlqcoudpxnrc.supabase.co`.
