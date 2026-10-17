# SECURITY.md — Presidi di Sicurezza e Conformità

## 1. Gestione dei Segreti e Isolamento Credenziali
- Tutte le chiavi API dei provider (`COINGECKO_API_KEY`, `TWELVE_DATA_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`, `GEMINI_API_KEY`) e la chiave privata `VAPID_PRIVATE_KEY` sono prive del prefisso `VITE_` e vengono lette esclusivamente dal backend (`server/backendEngine.ts` e `supabase/functions/*`).
- I file `.env` e `server/.data/*` sono esclusi dal versionamento tramite `.gitignore`.
- DemInvest **non richiede né archivia mai** password di broker, chiavi API di trading esecutivo, chiavi private crypto o seed phrase.

## 2. Controllo Accessi e `SINGLE_USER_MODE`
- Quando `SINGLE_USER_MODE=true` (impostazione predefinita), il sistema consente esclusivamente la registrazione del primo proprietario dell'istanza.
- Qualsiasi tentativo successivo di registrazione su `POST /api/auth/register` riceve `HTTP 403 Forbidden`.
- A livello database PostgreSQL (`supabase/migrations/0001_initial_schema.sql`), il trigger `trg_enforce_single_user_mode` e le policy **Row Level Security (RLS)** impediscono accessi o registrazioni non autorizzate.

## 3. Protezione XSS, Prompt Injection e Header HTTP
- Le risposte API impostano `X-Content-Type-Options: nosniff` e `X-Frame-Options: DENY`.
- Tutti gli input diretti a DemInvest AI vengono sanitizzati tramite `sanitizeUserPromptAndGuardOrders()`.
- Tutte le chiamate esterne verso provider di mercato applicano timeout rigorosi (`7500ms`) tramite `AbortController`.
