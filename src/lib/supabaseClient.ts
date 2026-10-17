// ==============================================================================
// DEMINVEST — SUPABASE CLIENT ADAPTER (FRONTEND SAFE — SOLO CHIAVE PUBLISHABLE)
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseCloudConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes('your-project-ref')
);

export const supabaseClient: SupabaseClient | null = isSupabaseCloudConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
