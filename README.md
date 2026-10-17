# DemInvest — Personal Investment Intelligence

**DemInvest** è una Progressive Web App (PWA) privata di market intelligence, analisi finanziaria quantitativa, trading research e supporto decisionale tramite intelligenza artificiale, progettata per l'uso esclusivo del proprietario (`SINGLE_USER_MODE`).

> **Vincolo Fondamentale:** DemInvest è un sistema di supporto alle decisioni e ricerca personale, **non un broker**. Nessuna funzionalità richiede credenziali di trading né può inviare o eseguire ordini automatici sugli intermediari dell'utente.

---

## Caratteristiche Principali (Release 1 — MVP Reale)

1. **Autenticazione Privata & `SINGLE_USER_MODE`**: Consente la registrazione esclusiva del primo account proprietario autorizzato e blocca registrazioni pubbliche successive (sia nel backend locale sia tramite trigger PostgreSQL in Supabase).
2. **Doppia Modalità di Esperienza (`Modalità Semplice` e `Modalità Pro`)**:
   - **Semplice**: Panoramica guidata, spiegazioni accessibili degli indicatori, grafico ad area semplificato.
   - **Pro**: Grafici a candele OHLCV (TradingView Lightweight Charts) con SMA(20) e livelli frattali di Supporto/Resistenza, Market Screener multiparametro, metriche quantitative (RSI, MACD, ADX, ATR, Bande di Bollinger, RVOL, OBV, Volatilità annualizzata, Max Drawdown) e audit log dei tool AI.
3. **Market Data Engine & Qualità Dati**:
   - Acquisizione server-side (nessuna chiave segreta mai esposta nel bundle frontend).
   - **Modalità LIVE Reale (predefinita)**: Zero prezzi inventati. Integra **CoinGecko API v3** (cripto-attività spot e candele OHLC reali), **Twelve Data API** (azioni, ETF, forex con supporto chiave personale e sandbox ufficiale `AAPL`, `EUR/USD`), **Alpha Vantage API** (azioni NYSE e serie storiche con supporto chiave personale e sandbox ufficiale `IBM`), **BCE / Frankfurter API** (tassi di cambio ufficiali della Banca Centrale Europea) e **FRED API** (indicatori macroeconomici).
   - **Modalità DEMO Didattica (separata ed esplicita)**: Attivabile volontariamente dall'utente con banner di avviso permanente per test offline o su strumenti privi di API key.
4. **Universal Instrument Registry & Broker Mapping**:
   - Distinzione rigorosa tra **Sottostante Economico**, **Strumento Negoziabile**, **Mercato (MIC)**, **Piattaforma/Broker** e **Provider del dato**.
   - Prevenzione collisioni tramite ISIN, CoinGecko ID, Contract Address e MIC (il solo ticker non è mai usato come ID globale).
   - Stato esplicito di verifica (`VERIFIED`, `USER_CONFIRMED`, `UNVERIFIED`), avviso critico Spot vs CFD e importazione CSV per **MetaTrader 4 / MetaTrader 5**.
5. **Motore Quantitativo, Time Horizon Engine & Signal Intelligence**:
   - Calcolo deterministico puro solo su candele chiuse (`isClosed !== false`).
   - Algoritmo esplicito di Supporti/Resistenze: `PIVOT_FRACTAL_ATR_CLUSTER_V1`.
   - Orizzonti `BREVISSIMO`, `BREVE`, `MEDIO`, `LUNGO` con blocco automatico dei segnali intraday (`BREVISSIMO`) in presenza di dati ritardati o End-Of-Day.
   - **No-Trade Detector** e **Punteggio Euristico Multifattoriale (0–100)** (mai presentato come probabilità di profitto).
6. **Notification Engine & Web Push (VAPID RFC 8292)**:
   - Chiavi crittografiche VAPID generate e gestite lato backend, Service Worker con listener `push` e `notificationclick`, test reale di notifica push, quiet hours, cooldown e guida d'installazione per iOS/iPadOS.
7. **DemInvest AI (Tool-Calling Autorizzato & Anti-Allucinazione)**:
   - Esegue esclusivamente tool backend autorizzati (`get_market_quote`, `get_asset_metadata`, `calculate_technical_indicators`, `get_portfolio_summary`, `calculate_scenario`) registrando ogni chiamata in `ai_tool_execution_logs`.
   - Opera sia con **Google Gemini API (`gemini-2.5-flash`)** quando `GEMINI_API_KEY` è configurata, sia in modalità **Analista Deterministico Tool-Based** verificato.
8. **Portfolio Tracker Manuale & Trading Lab**:
   - Registrazione acquisti, vendite, dividendi, cedole, commissioni, depositi e prelievi con conversioni valutarie ufficiali BCE, calcolo P&L realizzato/non realizzato, indice di concentrazione HHI e import/export CSV.
   - **Paper Trading** con calcolo esplicito di spread, slippage parametrico e commissioni.
   - **Strategy Backtesting** senza look-ahead bias (esecuzione sull'apertura della candela $t+1$) con separazione In-Sample (70%) / Out-of-Sample (30%).

---

## Avvio Rapido Locale

```bash
# 1. Installa le dipendenze
npm.cmd install

# 2. (Opzionale) Copia .env.example in .env per inserire le tue chiavi API personali
cp .env.example .env

# 3. Avvia il server full-stack (Frontend React + Backend API Server + Scheduler)
npm.cmd run dev
```

Apri `http://localhost:5173` nel browser:
1. Registra il tuo account proprietario iniziale.
2. Completa l'Onboarding scegliendo valuta, orizzonti, broker e Modalità Semplice o Pro.

---

## Esecuzione dei Test e Verifica Build

```bash
# Controllo rigoroso dei tipi TypeScript (strict mode)
npm.cmd run typecheck

# Suite di test unitari e di integrazione backend (Vitest)
npm.cmd test

# Suite End-to-End (Playwright)
npm.cmd run test:e2e

# Build di produzione
npm.cmd run build
```
