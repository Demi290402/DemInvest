# DEPLOYMENT.md — Guida Completa Passo-Passo per Supabase e Cloudflare Pages

Questa guida ti accompagna passo dopo passo nella configurazione di **Supabase** (PostgreSQL, Row Level Security, Edge Functions, Cron) e **Cloudflare Pages** (Frontend PWA + Pages Functions `/api/*` su rete Edge) prima e subito dopo il `git push`.

---

## FASE 1 — Configurazione di Supabase (Database, Sicurezza e Chiavi)

### 1.1 Creazione del Progetto Supabase
1. Accedi a [https://supabase.com/dashboard](https://supabase.com/dashboard) e clicca su **New project**.
2. Scegli la tua organizzazione e compila:
   - **Name**: `DemInvest`
   - **Database Password**: genera una password robusta e salvala in un gestore password.
   - **Region**: `Central EU (Frankfurt)` o `West EU (Ireland)` per latenza minima dall'Italia.
3. Clicca su **Create new project** e attendi circa 60–90 secondi che il database PostgreSQL sia pronto.

### 1.2 Creazione delle Tabelle, Trigger `SINGLE_USER_MODE` e Policy RLS
1. Nel menu laterale sinistro di Supabase, clicca su **SQL Editor** → **New query**.
2. Apri il file locale [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql), copia **tutto il contenuto** e incollalo nell'editor SQL di Supabase.
3. Clicca su **Run** (o premi `Ctrl + Enter`).
4. Verifica che in basso compaia `Success. No rows returned`: questo conferma che tutte le 19 tabelle (incluso `public.app_state_store` per la sincronizzazione cloud con Cloudflare Pages Functions), gli indici, le policy RLS e il trigger `trg_enforce_single_user_mode` sono attivi.

### 1.3 Recupero delle Credenziali Supabase
1. Nel menu laterale di Supabase vai su **Project Settings** (icona ingranaggio in basso) → **API**.
2. Annota i seguenti 3 valori (ti serviranno nella Fase 3 su Cloudflare):
   - **Project URL**: es. `https://abcdefghijklm.supabase.co` -> corrisponde a `SUPABASE_URL` e `VITE_SUPABASE_URL`
   - **Project API Keys → `anon` `public`**: -> corrisponde a `VITE_SUPABASE_ANON_KEY`
   - **Project API Keys → `service_role` `secret`** (clicca su *Reveal*): -> corrisponde a `SUPABASE_SERVICE_ROLE_KEY` (**ATTENZIONE**: questa chiave va inserita **solo** come variabile backend su Cloudflare, **mai** con prefisso `VITE_`).

### 1.4 (Opzionale ma Consigliato) Deploy delle Supabase Edge Functions e Cron Server-Side
Se desideri eseguire anche il job pianificato autonomo su Supabase ogni 5 minuti:
1. Nel terminale locale:
   ```powershell
   npx.cmd supabase login
   npx.cmd supabase link --project-ref <IL_TUO_PROJECT_REF>
   npx.cmd supabase secrets set COINGECKO_API_KEY=... TWELVE_DATA_API_KEY=... ALPHA_VANTAGE_API_KEY=... GEMINI_API_KEY=... SCHEDULER_CRON_SECRET=un_segreto_lungo_casuale
   npx.cmd supabase functions deploy market-data
   npx.cmd supabase functions deploy scheduler-job
   ```
2. In Supabase **Database → Extensions**, abilita `pg_cron` e `pg_net`, quindi esegui in **SQL Editor**:
   ```sql
   SELECT cron.schedule(
     'deminvest-priority-monitor',
     '*/5 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://<IL_TUO_PROJECT_REF>.supabase.co/functions/v1/scheduler-job',
       headers := '{"Content-Type": "application/json", "x-scheduler-secret": "un_segreto_lungo_casuale"}'::jsonb
     );
     $$
   );
   ```

---

## FASE 2 — Generazione Chiavi VAPID e `git push` del Repository

### 2.1 Generazione o Lettura delle Chiavi VAPID per Web Push
Il progetto ha già generato al primo avvio locale una coppia di chiavi crittografiche VAPID in `server/.data/vapid-keys.json` (ignorata da Git per sicurezza grazie a `.gitignore`).
Puoi leggere le chiavi già pronte oppure generarne una nuova coppia con:
```powershell
npx.cmd web-push generate-vapid-keys
```
Annota `Public Key` (`VAPID_PUBLIC_KEY`) e `Private Key` (`VAPID_PRIVATE_KEY`).

### 2.2 Verifica Sicurezza Git e Push su GitHub
Prima di eseguire il push, assicurati che nessun file `.env` o `server/.data` venga tracciato:
```powershell
git init
git status
git add .
git commit -m "feat: initial release DemInvest MVP Reale (PWA + Quantitative & AI Engines)"
git branch -M main
git remote add origin https://github.com/<TUO_USERNAME>/<TUO_REPO_PRIVATO>.git
git push -u origin main
```

---

## FASE 3 — Configurazione di Cloudflare Pages (Frontend PWA + API Edge `/api/*`)

Il repository include già:
- [`functions/api/[[path]].ts`](./functions/api/[[path]].ts): Cloudflare Pages Function che espone tutte le rotte `/api/*` sulla rete Edge di Cloudflare e sincronizza lo stato con Supabase (`public.app_state_store`).
- [`wrangler.toml`](./wrangler.toml): configurazione `nodejs_compat` e directory di output `dist`.
- [`public/_redirects`](./public/_redirects) e [`public/_headers`](./public/_headers): routing SPA e header di sicurezza HTTP (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cache-Control` per il Service Worker `/sw.js`).

### 3.1 Collegamento del Repository a Cloudflare Pages
1. Accedi alla dashboard di [Cloudflare](https://dash.cloudflare.com).
2. Nel menu laterale sinistro vai su **Workers & Pages** → clicca su **Create** → scheda **Pages** → **Connect to Git**.
3. Autorizza il tuo account GitHub/GitLab e seleziona il repository privato **`DemInvest`**.
4. Nella schermata **Set up builds and deployments**, imposta:
   - **Project name**: `deminvest` (o il nome che preferisci)
   - **Production branch**: `main`
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

### 3.2 Configurazione delle Variabili d'Ambiente (Environment Variables)
Ancora nella schermata di creazione (oppure dopo in **Settings → Environment variables**), aggiungi le seguenti variabili sia per **Production** che per **Preview** (spunta *Encrypt* per i segreti):

| Variabile | Valore | Tipo |
| :--- | :--- | :--- |
| `NODE_VERSION` | `20` | Plaintext |
| `SINGLE_USER_MODE` | `true` | Plaintext |
| `SUPABASE_URL` | `https://<tuo-project-ref>.supabase.co` | Plaintext |
| `VITE_SUPABASE_URL` | `https://<tuo-project-ref>.supabase.co` | Plaintext |
| `VITE_SUPABASE_ANON_KEY` | `<la-tua-anon-public-key-supabase>` | Plaintext |
| `SUPABASE_SERVICE_ROLE_KEY` | `<la-tua-service-role-secret-key-supabase>` | **Secret (Encrypted)** |
| `VAPID_PUBLIC_KEY` | `<la-tua-vapid-public-key>` | Plaintext |
| `VAPID_PRIVATE_KEY` | `<la-tua-vapid-private-key>` | **Secret (Encrypted)** |
| `VAPID_SUBJECT` | `mailto:tua-email@dominio.it` | Plaintext |
| `COINGECKO_API_KEY` | *(Opzionale: tua chiave CoinGecko Demo/Pro)* | **Secret (Encrypted)** |
| `TWELVE_DATA_API_KEY` | *(Consigliato: tua chiave gratuita Twelve Data)* | **Secret (Encrypted)** |
| `ALPHA_VANTAGE_API_KEY` | *(Consigliato: tua chiave gratuita Alpha Vantage)* | **Secret (Encrypted)** |
| `FRED_API_KEY` | *(Opzionale: tua chiave gratuita FRED)* | **Secret (Encrypted)** |
| `GEMINI_API_KEY` | *(Consigliato: tua chiave Google AI Studio Gemini)* | **Secret (Encrypted)** |

### 3.3 Abilitazione Flag `nodejs_compat` su Cloudflare Pages
1. Clicca su **Save and Deploy**.
2. Vai su **Workers & Pages → deminvest → Settings → Functions → Compatibility flags**.
3. Verifica che sia presente il flag **`nodejs_compat`** (sia per Production che per Preview). Se non è già stato letto automaticamente da `wrangler.toml`, aggiungilo scrivendo `nodejs_compat` e salva.

---

## FASE 4 — Verifica Post-Deploy e Messa in Sicurezza Dell'Owner

1. Apri l'URL HTTPS generato da Cloudflare Pages (es. `https://deminvest.pages.dev` o il tuo dominio personalizzato).
2. **Registrazione Proprietario (`SINGLE_USER_MODE`)**:
   - Essendo il primo accesso assoluto, crea subito il tuo account proprietario inserendo la tua email e una password robusta.
   - Una volta completata la registrazione, lo stato viene salvato su Supabase PostgreSQL (`public.app_state_store`) e qualsiasi successivo tentativo di registrazione da parte di terzi verrà bloccato con `HTTP 403 Forbidden`.
3. **Completamento Onboarding & Test Notifiche Push**:
   - Completa l'onboarding, vai nella sezione **Notifiche & Impostazioni**, clicca su **Attiva Notifiche Push su questo dispositivo** e poi su **Invia Notifica di Test Reale**.
4. **Installazione PWA**:
   - **Android / Desktop (Chrome/Edge)**: clicca sull'icona "Installa DemInvest" nella barra degli indirizzi.
   - **iOS / iPadOS (Safari)**: tocca il pulsante *Condividi* → *Aggiungi alla schermata Home*.
