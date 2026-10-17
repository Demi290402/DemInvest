// ==============================================================================
// DEMINVEST — CLOUDFLARE WORKER ENTRYPOINT (STATIC ASSETS + /api/* BACKEND)
// ==============================================================================

import { onRequest } from '../functions/api/[[path]]';
import { GENERATED_WORKER_ENV } from './generatedWorkerEnv';

interface CloudflareEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    // Uniamo le variabili generate a build-time con quelle runtime del Worker
    const mergedEnv: Record<string, string | undefined> = {
      ...GENERATED_WORKER_ENV,
    };
    for (const [k, v] of Object.entries(env || {})) {
      if (typeof v === 'string' && v.trim() !== '') {
        mergedEnv[k] = v;
      }
    }

    // Tutte le rotte /api/* vengono gestite dal backend Edge DemInvest
    if (url.pathname.startsWith('/api/')) {
      return onRequest({
        request,
        env: mergedEnv,
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
