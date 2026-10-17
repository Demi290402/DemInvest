// ==============================================================================
// DEMINVEST — SUPABASE EDGE FUNCTION: MARKET DATA PROXY (SECRETS BACKEND-ONLY)
// ==============================================================================
// Deploy: supabase functions deploy market-data
// ==============================================================================

// @ts-expect-error Deno global in Supabase Edge Runtime
const DenoEnv = typeof Deno !== 'undefined' ? Deno.env : { get: (k: string) => process.env[k] };

export async function handleMarketDataEdgeRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') || 'coingecko';
  const symbol = url.searchParams.get('symbol') || 'bitcoin';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (provider === 'coingecko') {
      const cgKey = DenoEnv.get('COINGECKO_API_KEY');
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (cgKey) headers['x-cg-demo-api-key'] = cgKey;

      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(symbol)}`,
        { headers }
      );
      const data = await res.json();
      return new Response(JSON.stringify({ provider: 'coingecko', data, fetchedAt: new Date().toISOString() }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (provider === 'twelvedata') {
      const tdKey = DenoEnv.get('TWELVE_DATA_API_KEY') || 'demo';
      const res = await fetch(
        `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(tdKey)}`
      );
      const data = await res.json();
      return new Response(JSON.stringify({ provider: 'twelvedata', data, fetchedAt: new Date().toISOString() }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Provider non supportato' }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Edge error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
