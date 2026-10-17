// ==============================================================================
// DEMINVEST — SUPABASE CLIENT ADAPTER (FRONTEND SAFE — SOLO CHIAVE PUBLISHABLE/ANON)
// ==============================================================================
// Supporta sia VITE_SUPABASE_ANON_KEY sia VITE_SUPABASE_PUBLISHABLE_KEY e consente
// l'inizializzazione dinamica dalla configurazione pubblica di bootstrap.
// NESSUNA chiave service_role viene mai esposta o accettata in questo modulo.
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envSupabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://yumqptqhdlqcoudpxnrc.supabase.co';

const envSupabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);

export const isSupabaseCloudConfigured = Boolean(
  envSupabaseUrl &&
    envSupabasePublishableKey &&
    !envSupabaseUrl.includes('your-project-ref') &&
    !envSupabasePublishableKey.includes('your-supabase')
);

let cachedClient: SupabaseClient | null = isSupabaseCloudConfigured
  ? createClient(envSupabaseUrl, envSupabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const supabaseClient: SupabaseClient | null = cachedClient;

export function getOrInitFrontendSupabaseClient(
  runtimeUrl?: string,
  runtimeAnonKey?: string
): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = (runtimeUrl || envSupabaseUrl || '').trim();
  const key = (runtimeAnonKey || envSupabasePublishableKey || '').trim();
  if (
    !url ||
    !key ||
    url.includes('your-project-ref') ||
    key.includes('your-supabase')
  ) {
    return null;
  }
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cachedClient;
}
