// ==============================================================================
// DEMINVEST — BUILD-TIME TO WORKER-RUNTIME ENVIRONMENT BRIDGE
// ==============================================================================
// Su Cloudflare Workers Builds, le variabili configurate nella sezione Build
// sono presenti in process.env durante `npm run build`, ma non vengono passate
// automaticamente al runtime del Worker da `npx wrangler deploy`.
// Questo script genera `server/generatedWorkerEnv.ts` (mai incluso nel bundle
// frontend `./dist`) così il Worker Edge ha accesso immediato a tutte le
// variabili configurate nella dashboard Cloudflare.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';

const ENV_KEYS = [
  'SINGLE_USER_MODE',
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_KEY',
  'VAPID_PUBLIC_KEY',
  'VITE_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'COINGECKO_API_KEY',
  'TWELVE_DATA_API_KEY',
  'ALPHA_VANTAGE_API_KEY',
  'FRED_API_KEY',
  'GEMINI_API_KEY',
  'DAILY_API_CALL_BUDGET',
];

const captured = {};
for (const key of ENV_KEYS) {
  if (process.env[key]) {
    captured[key] = String(process.env[key]).trim();
  }
}

// Ricerca euristica di eventuali variabili Supabase con nomi personalizzati in process.env
for (const [k, v] of Object.entries(process.env)) {
  if (!v || typeof v !== 'string') continue;
  const val = v.trim();
  const upper = k.toUpperCase();
  if (upper.includes('SUPABASE')) {
    if (val.startsWith('http') && !captured.SUPABASE_URL) {
      captured.SUPABASE_URL = val;
      captured.VITE_SUPABASE_URL = val;
    } else if (
      (upper.includes('SERVICE') || upper.includes('SECRET') || val.startsWith('sb_secret_')) &&
      !captured.SUPABASE_SERVICE_ROLE_KEY
    ) {
      captured.SUPABASE_SERVICE_ROLE_KEY = val;
    } else if (
      (upper.includes('ANON') ||
        upper.includes('PUBLISHABLE') ||
        upper.includes('KEY') ||
        val.startsWith('sb_publishable_') ||
        val.startsWith('eyJ')) &&
      !captured.SUPABASE_ANON_KEY
    ) {
      captured.SUPABASE_ANON_KEY = val;
      captured.VITE_SUPABASE_ANON_KEY = val;
      captured.VITE_SUPABASE_PUBLISHABLE_KEY = val;
    }
  }
}

// Normalizza gli alias delle chiavi Supabase
const resolvedAnon =
  captured.VITE_SUPABASE_ANON_KEY ||
  captured.VITE_SUPABASE_PUBLISHABLE_KEY ||
  captured.SUPABASE_ANON_KEY ||
  captured.SUPABASE_PUBLISHABLE_KEY ||
  captured.SUPABASE_KEY ||
  captured.VITE_SUPABASE_KEY ||
  '';
if (resolvedAnon) {
  captured.SUPABASE_ANON_KEY = resolvedAnon;
  captured.VITE_SUPABASE_ANON_KEY = resolvedAnon;
  captured.VITE_SUPABASE_PUBLISHABLE_KEY = resolvedAnon;
}

const resolvedService =
  captured.SUPABASE_SERVICE_ROLE_KEY ||
  captured.SUPABASE_SECRET_KEY ||
  captured.SUPABASE_SERVICE_KEY ||
  '';
if (resolvedService) {
  captured.SUPABASE_SERVICE_ROLE_KEY = resolvedService;
}

// Fallback esplicito all'URL del progetto Supabase dell'utente se non sovrascritto
if (!captured.SUPABASE_URL && !captured.VITE_SUPABASE_URL) {
  captured.SUPABASE_URL = 'https://yumqptqhdlqcoudpxnrc.supabase.co';
  captured.VITE_SUPABASE_URL = 'https://yumqptqhdlqcoudpxnrc.supabase.co';
}

const targetFile = path.resolve(process.cwd(), 'server', 'generatedWorkerEnv.ts');
const content = `// AUTO-GENERATED AT BUILD TIME FOR SERVER-SIDE WORKER RUNTIME ONLY
export const GENERATED_WORKER_ENV: Record<string, string | undefined> = ${JSON.stringify(
  captured,
  null,
  2
)};
`;

fs.writeFileSync(targetFile, content, 'utf-8');
console.log(
  `[DemInvest Build Bridge] Variabili collegate per il Worker Edge: ${
    Object.keys(captured).join(', ') || 'nessuna'
  }`
);
