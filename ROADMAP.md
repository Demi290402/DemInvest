# ROADMAP.md — Piano Evolutivo delle Release DemInvest

## Release 1 — MVP Reale (COMPLETATA E VERIFICATA)
- [x] Setup progetto React + TypeScript (strict mode) + Vite + Tailwind CSS
- [x] Design system Fintech Premium (Verde Smeraldo & Antracite, Dark/Light mode)
- [x] PWA installabile con Web App Manifest, Service Worker, Cache versionata e pagina Offline sicura
- [x] Autenticazione privata con `SINGLE_USER_MODE` e Onboarding completo
- [x] Dashboard responsive con stato apertura borse, watchlist, segnali e freschezza dati
- [x] Switch istantaneo e persistito tra **Modalità Semplice** e **Modalità Pro**
- [x] Universal Instrument Registry e Broker Instrument Mapping (`VERIFIED`, `USER_CONFIRMED`, `UNVERIFIED` + Import CSV MT4/MT5)
- [x] Provider reali integrati (CoinGecko API v3, Twelve Data API, Alpha Vantage API, BCE Frankfurter FX)
- [x] Grafico interattivo TradingView Lightweight Charts (Candele OHLCV + SMA + Supporti/Resistenze frattali)
- [x] Motore Quantitativo Deterministico, Time Horizon Engine e Signal Intelligence Engine (con No-Trade Detector)
- [x] Motore Web Push VAPID server-side, regole di alert con cooldown e Centro Notifiche
- [x] DemInvest AI contestuale con tool backend autorizzati e audit log
- [x] Portfolio Tracker manuale multi-valuta (con cambi BCE, rischio concentrazione HHI e import/export CSV)
- [x] Trading Lab con Paper Trading (spread, slippage, commissioni), Strategy Backtesting anti-bias e Trading Journal
- [x] Provider Health Dashboard e suite di test automatizzati (Vitest + Playwright)

---

## Release 2 — Analisi Avanzata (Pianificata)
- [ ] Analisi multi-timeframe sincronizzata su 3 finestre simultanee (es. `1w` + `1d` + `4h`)
- [ ] Market Heatmap settoriale e per capitalizzazione
- [ ] Integrazione estesa serie storiche macroeconomiche FRED con gestione revisioni (`vintage dates`)
- [ ] Feed notizie verificate con analisi del sentiment disaccoppiata dal prezzo
- [ ] Statistiche storiche di calibrazione per ciascuna strategia del Signal Engine

---

## Release 3 — Portfolio Intelligence (Pianificata)
- [ ] Matrice di correlazione (Correlation Matrix) rolling a 30/90/252 giorni tra gli asset in portafoglio
- [ ] Stress Testing parametrico su scenari storici di crisi
- [ ] Simulatore Piani di Accumulo (PAC) e ribilanciamento simulato con stima dei costi commissionali
- [ ] Reportistica fiscale indicativa (plusvalenze/minusvalenze ed esportazione PDF/CSV)

---

## Release 4 — Funzioni Sperimentali (Disabilitate per Impostazione Predefinita)
- [ ] Analisi on-chain e rilevamento rischi smart contract per token ERC-20/SPL
- [ ] Forward testing automatico su portafogli multi-strategia
