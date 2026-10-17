# CHANGELOG.md — Storico Versioni DemInvest

## [1.0.0] — 2026-10-17 (Release 1 — MVP Reale)

### Aggiunto
- **Core & Architettura**: Setup full-stack React + TypeScript (`strict: true`) + Vite + Tailwind CSS + Backend API Middleware + Supabase SQL Migration (`0001_initial_schema.sql`) ed Edge Functions.
- **Autenticazione & Onboarding**: Implementazione `SINGLE_USER_MODE` e wizard di configurazione iniziale per esperienza, valuta, orizzonti e broker.
- **Market Data Engine**: Adapter per CoinGecko API v3 (live crypto), Twelve Data API (live/sandbox `AAPL`, `EUR/USD`), Alpha Vantage API (live/sandbox `IBM`), BCE Frankfurter API (tassi di cambio ufficiali) e FRED API.
- **Universal Instrument Registry & Broker Mapping**: Distinzione rigorosa tra sottostante, strumento negoziabile, venue MIC e simbolo broker (`VERIFIED`, `USER_CONFIRMED`, `UNVERIFIED`), con avvisi Spot vs CFD e importatore CSV per MetaTrader 4/5.
- **Quantitative & Signal Intelligence Engine**: Calcolo deterministico di SMA, EMA, ADX, RSI, MACD, ROC, Stochastic, ATR, Bande di Bollinger, Volatilità annualizzata, Max Drawdown, RVOL, OBV e Supporti/Resistenze (`PIVOT_FRACTAL_ATR_CLUSTER_V1`), più blocco segnali intraday su dati ritardati e No-Trade Detector.
- **Web Push & Scheduler**: Protocollo VAPID RFC 8292 con Service Worker, test reale di invio push, quiet hours, cooldown e coda di priorità.
- **DemInvest AI**: Assistente contestuale con tool backend autorizzati, audit log (`ai_tool_execution_logs`) e guardrail anti-allucinazione / anti-ordine.
- **Portfolio Tracker & Trading Lab**: Contabilità portafoglio manuale multi-valuta, Paper Trading con frizioni esplicite, Strategy Backtesting senza look-ahead bias (split In-Sample/Out-of-Sample) e Trading Journal.
- **Qualità & Testing**: Suite unitaria e di integrazione Vitest (17 test passati) e test E2E Playwright.
