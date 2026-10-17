// ==============================================================================
// DEMINVEST — CLOUDFLARE WORKER ENTRYPOINT (STATIC ASSETS + /api/* BACKEND)
// ==============================================================================

import { onRequest } from '../functions/api/[[path]]';

interface CloudflareEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    // Estraiamo solo le variabili stringa per il backend engine
    const stringEnv: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env || {})) {
      if (typeof v === 'string') {
        stringEnv[k] = v;
      }
    }

    // Tutte le rotte /api/* vengono gestite dal backend Edge DemInvest
    if (url.pathname.startsWith('/api/')) {
      return onRequest({
        request,
        env: stringEnv,
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
