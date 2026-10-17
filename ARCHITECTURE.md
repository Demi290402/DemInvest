# ARCHITECTURE.md — Architettura di Sistema DemInvest

## 1. Principi Architetturali

DemInvest adotta un'architettura modulare full-stack progettata per garantire:
1. **Isolamento dei Segreti (Backend-Only Secrets)**: Nessuna chiave API privata (`COINGECKO_API_KEY`, `TWELVE_DATA_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`, `GEMINI_API_KEY`, `VAPID_PRIVATE_KEY`) viene mai inclusa nel bundle frontend.
2. **Separazione tra Motore Quantitativo e AI**: Tutti gli indicatori tecnici, i livelli di supporto/resistenza, la contabilità di portafoglio e la generazione dei segnali avvengono in motori deterministici TypeScript testati (`src/engines/*`), mai delegati arbitrariamente a un LLM.
3. **Veridicità dei Dati Finanziari**: Ogni quotazione trasporta `providerId`, `observedAt`, `fetchedAt`, `freshness` (`REALTIME`, `DELAYED`, `EOD`, `STALE`), `delaySeconds` e `validity`.

---

## 2. Struttura delle Cartelle

```text
DemInvest/
├── public/
│   ├── manifest.webmanifest     # Web App Manifest installabile (Android, iOS, Desktop)
│   ├── sw.js                    # Service Worker (Cache versionata + Web Push VAPID)
│   ├── offline.html             # Pagina fallback offline con avviso sicurezza prezzi
│   └── icons/                   # Icone vettoriali SVG (192x192, 512x512)
├── server/
│   ├── backendEngine.ts         # Adapter Provider, Scheduler, Web Push VAPID, AI Engine
│   ├── apiPlugin.ts             # Middleware HTTP /api/* e daemon cron server-side
│   └── demoReferenceData.ts     # Dataset didattico isolato (usato SOLO in modalità DEMO)
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql # Schema PostgreSQL normalizzato + RLS + trigger
│   └── functions/
│       ├── market-data/index.ts # Supabase Edge Function proxy dati di mercato
│       └── scheduler-job/index.ts # Supabase Edge Function per cron job pianificati
├── src/
│   ├── types/
│   │   └── domain.ts            # Modello di dominio TypeScript (strict mode)
│   ├── engines/
│   │   ├── instrumentRegistry.ts      # Universal Instrument Registry & Broker Mapping
│   │   ├── quantitativeEngine.ts      # Indicatori tecnici & Frattali S/R deterministici
│   │   ├── signalIntelligenceEngine.ts # Time Horizon Engine, Segnali & No-Trade Detector
│   │   ├── portfolioEngine.ts         # Contabilità portafoglio, HHI & cambi BCE
│   │   └── paperAndBacktestEngine.ts  # Paper Trading & Strategy Backtesting anti-bias
│   ├── context/
│   │   └── DemInvestContext.tsx # Stato applicativo React e client API
│   ├── components/
│   │   ├── TradingViewChart.tsx # Grafico TradingView Lightweight Charts (OHLC / Area)
│   │   ├── AuthAndOnboardingView.tsx # Login/Registrazione SINGLE_USER_MODE & Onboarding
│   │   └── ContextualAiDrawer.tsx # Assistente AI contestuale + visualizzatore Tool Logs
│   └── views/
│       ├── DashboardView.tsx
│       ├── MarketsView.tsx
│       ├── OpportunitiesView.tsx
│       ├── TradingLabView.tsx
│       ├── PortfolioView.tsx
│       └── NotificationsAndSettingsView.tsx
└── tests/
    ├── engines.test.ts          # Unit test (RSI, MACD, SMA/EMA, ATR, FX, Segnali, Registry)
    ├── backend.integration.test.ts # Test integrazione backend, VAPID, AI guardrails
    └── e2e/deminvest.spec.ts    # Test End-to-End Playwright
```
