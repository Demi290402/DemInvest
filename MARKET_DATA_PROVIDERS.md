# MARKET_DATA_PROVIDERS.md — Provider Dati, Limiti e Regole di Qualità

## 1. Architettura Provider Adapters

Il modulo `server/backendEngine.ts` centralizza tutte le chiamate esterne. L'interfaccia utente interroga esclusivamente gli endpoint interni `/api/market/*`.

| Provider | Ambito | Credenziali | Stato Predefinito | Note & Limiti Conosciuti |
| :--- | :--- | :--- | :--- | :--- |
| **CoinGecko API v3** | Catalogo e serie OHLC/Spot Crypto | Opzionale (`COINGECKO_API_KEY`) | `OPERATIONAL` | Funziona subito tramite endpoint pubblico ufficiale (`api.coingecko.com/api/v3`); cache server-side di 55s per rispettare il rate limit di ~10-30 req/min. |
| **Twelve Data API** | Azioni, ETF, Indici, Forex | `TWELVE_DATA_API_KEY` | `OPERATIONAL_SANDBOX` | Senza chiave personale usa la modalità sandbox ufficiale Twelve Data per `AAPL` e `EUR/USD`. Con chiave personale sblocca l'intero catalogo globale (inclusi ETF su Xetra come `VWCE`). |
| **Alpha Vantage API** | Azioni NYSE/NASDAQ e Serie Giornaliera | `ALPHA_VANTAGE_API_KEY` | `OPERATIONAL_SANDBOX` | Senza chiave personale usa la sandbox ufficiale Alpha Vantage per `IBM` (`GLOBAL_QUOTE` e `TIME_SERIES_DAILY`). Con chiave personale sblocca ricerca e news sentiment. |
| **BCE / Frankfurter** | Tassi di cambio ufficiali (FX) | Pubblico istituzionale | `OPERATIONAL` | Pubblicato giornalmente dalla Banca Centrale Europea (`api.frankfurter.app`). Usato per tutte le conversioni valutarie del portafoglio. |
| **FRED API** | Dati macroeconomici USA | `FRED_API_KEY` | `UNCONFIGURED` | Richiede chiave API gratuita FRED (Federal Reserve Bank of St. Louis). |

## 2. Regole di Qualità e Freschezza del Dato

Ogni oggetto `MarketQuote` include obbligatoriamente:
- `observedAt`: Timestamp UTC della rilevazione del prezzo presso la fonte.
- `fetchedAt`: Timestamp UTC dell'acquisizione da parte del backend DemInvest.
- `freshness`:
  - `REALTIME`: ritardo $\le 90$ secondi.
  - `DELAYED`: ritardo compreso tra $91$ e $900$ secondi.
  - `EOD`: dato di fine giornata (End-Of-Day) o mercato chiuso.
  - `STALE`: dato obsoleto.
- `validity`: `VALID`, `STALE`, `INCOMPLETE`, `SUSPENDED`.

Quando un provider non è configurato per uno specifico strumento in **Modalità LIVE**, DemInvest restituisce `validity: 'SUSPENDED'` e non inventa mai prezzi simulati.
