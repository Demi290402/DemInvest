// ==============================================================================
// DEMINVEST — SUPABASE CLIENT ADAPTER (FRONTEND SAFE — SOLO CHIAVE PUBLISHABLE/ANON)
// ==============================================================================
// Supporta sia VITE_SUPABASE_ANON_KEY sia VITE_SUPABASE_PUBLISHABLE_KEY e consente
// l'inizializzazione dinamica anche da localStorage dell'istanza privata.
// NESSUNA chiave service_role viene mai esposta nel client pubblico.
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://yumqptqhdlqcoudpxnrc.supabase.co';

const envSupabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;

const envSupabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  '';

function readStoredAnonKey(): string {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  return window.localStorage.getItem('deminvest_supabase_anon_key') || '';
}

function readStoredUrl(): string {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  return window.localStorage.getItem('deminvest_supabase_url') || '';
}

let cachedClient: SupabaseClient | null = null;
let cachedKeyUsed = '';

export function getOrInitFrontendSupabaseClient(
  runtimeUrl?: string,
  runtimeAnonKey?: string
): SupabaseClient | null {
  const url = (runtimeUrl || readStoredUrl() || envSupabaseUrl || DEFAULT_SUPABASE_URL).trim();
  const key = (runtimeAnonKey || readStoredAnonKey() || envSupabasePublishableKey || '').trim();

  if (
    !url ||
    !key ||
    url.includes('your-project-ref') ||
    key.includes('your-supabase')
  ) {
    return null;
  }

  if (cachedClient && cachedKeyUsed === `${url}::${key}`) {
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  cachedKeyUsed = `${url}::${key}`;
  return cachedClient;
}

export function saveFrontendSupabaseAnonKey(anonKey: string, url?: string): SupabaseClient | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cleanKey = anonKey.trim();
    if (cleanKey) {
      window.localStorage.setItem('deminvest_supabase_anon_key', cleanKey);
    }
    if (url && url.trim()) {
      window.localStorage.setItem('deminvest_supabase_url', url.trim());
    }
  }
  cachedClient = null;
  cachedKeyUsed = '';
  return getOrInitFrontendSupabaseClient(url, anonKey);
}

export function getActiveFrontendSupabaseConfig(): {
  url: string;
  anonKey: string;
  hasAnonKey: boolean;
} {
  const url = (readStoredUrl() || envSupabaseUrl || DEFAULT_SUPABASE_URL).trim();
  const anonKey = (readStoredAnonKey() || envSupabasePublishableKey || '').trim();
  return { url, anonKey, hasAnonKey: Boolean(anonKey) };
}

export const isSupabaseCloudConfigured = Boolean(getOrInitFrontendSupabaseClient());
export const supabaseClient: SupabaseClient | null = getOrInitFrontendSupabaseClient();

