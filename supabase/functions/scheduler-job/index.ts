// ==============================================================================
// DEMINVEST — SUPABASE EDGE FUNCTION: SCHEDULED CRON JOB (SIGNAL & PUSH ENGINE)
// ==============================================================================
// Invocata tramite pg_cron / Supabase Cron:
// SELECT cron.schedule('deminvest-monitor-5m', '*/5 * * * *', $$ ... $$);
// Protetta da header `x-scheduler-secret`.
// ==============================================================================

// @ts-expect-error Deno global in Supabase Edge Runtime
const DenoEnv = typeof Deno !== 'undefined' ? Deno.env : { get: (k: string) => process.env[k] };

export async function handleScheduledCronEdgeRequest(req: Request): Promise<Response> {
  const expectedSecret = DenoEnv.get('SCHEDULER_CRON_SECRET');
  const providedSecret = req.headers.get('x-scheduler-secret');

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: 'Accesso negato: SCHEDULER_CRON_SECRET mancante o non valido.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      status: 'COMPLETED',
      jobName: 'deminvest-priority-signal-monitor',
      executedAt: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
