// ==============================================================================
// DEMINVEST — CLOUDFLARE WORKER ENTRYPOINT (STATIC ASSETS + /api/* BACKEND)
// ==============================================================================

import { onRequest } from '../functions/api/[[path]]';

interface CloudflareEnv extends Record<string, string | undefined> {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    // Tutte le rotte /api/* vengono gestite dal backend Edge DemInvest
    if (url.pathname.startsWith('/api/')) {
      return onRequest({
        request,
        env,
      });
    }

    // Tutte le altre rotte statiche / SPA vengono servite dal binding ASSETS (./dist)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('DemInvest Worker attivo, ma asset statico non trovato.', {
      status: 404,
    });
  },
};
