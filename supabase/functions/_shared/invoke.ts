/**
 * invoke.ts — Llamadas inter-función seguras (reemplaza supabase.functions.invoke)
 *
 * NUNCA usar supabase.functions.invoke() directamente. El SDK de Supabase JS v2
 * retorna { data, error } sin lanzar excepción en errores HTTP, lo que causa
 * fallos silenciosos cuando se usa con .catch() o sin verificar el campo error.
 *
 * Incidente 2026-04-23: analyze-leads no se ejecutó por 24h+ porque
 * supabase.functions.invoke fallaba silenciosamente desde evolution-webhook.
 *
 * Este módulo usa fetch() directo con logging de errores a activity_logs.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface InvokeOptions {
  /** Nombre de la función a invocar */
  functionName: string;
  /** Body de la petición (se serializa a JSON) */
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>;
  /** Cliente Supabase para logging de errores a activity_logs (opcional) */
  supabase?: SupabaseClient;
  /** Contexto para el log de error (ej: nombre del lead) */
  errorContext?: string;
  /** Si true, espera la respuesta y la retorna. Si false, fire-and-forget con logging. Default: false */
  await?: boolean;
}

interface InvokeResult {
  ok: boolean;
  status: number;
  // deno-lint-ignore no-explicit-any
  data: any;
  error?: string;
}

/**
 * Invoca una Edge Function de Supabase vía fetch directo.
 *
 * Modo fire-and-forget (default): lanza la petición y loggea errores en background.
 * Modo await: espera la respuesta y retorna { ok, status, data, error }.
 */
export async function invokeFunction(opts: InvokeOptions): Promise<InvokeResult | void> {
  const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${opts.functionName}`;
  const authKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

  const doFetch = async (): Promise<InvokeResult> => {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
      },
      body: JSON.stringify(opts.body),
    });

    const text = await res.text();
    // deno-lint-ignore no-explicit-any
    let data: any = text;
    try { data = JSON.parse(text); } catch (_) { /* plain text response */ }

    if (!res.ok) {
      const errMsg = `${opts.functionName} HTTP ${res.status}: ${text.substring(0, 200)}`;
      console.error(`[invoke] ${errMsg}`);
      if (opts.supabase) {
        opts.supabase.from('activity_logs').insert({
          action: 'ERROR',
          resource: 'BRAIN',
          description: `${opts.functionName} falló${opts.errorContext ? ` (${opts.errorContext})` : ''}: HTTP ${res.status} — ${text.substring(0, 150)}`,
          status: 'ERROR',
        }).then(() => {}, () => {});
      }
      return { ok: false, status: res.status, data, error: errMsg };
    }

    return { ok: true, status: res.status, data };
  };

  if (opts.await) {
    try {
      return await doFetch();
    } catch (err) {
      const errMsg = `${opts.functionName} fetch crash: ${(err as Error)?.message || String(err).substring(0, 200)}`;
      console.error(`[invoke] ${errMsg}`);
      if (opts.supabase) {
        opts.supabase.from('activity_logs').insert({
          action: 'ERROR',
          resource: 'BRAIN',
          description: `${opts.functionName} crash${opts.errorContext ? ` (${opts.errorContext})` : ''}: ${(err as Error)?.message || String(err).substring(0, 150)}`,
          status: 'ERROR',
        }).then(() => {}, () => {});
      }
      return { ok: false, status: 0, data: null, error: errMsg };
    }
  }

  // Fire-and-forget con logging
  doFetch().catch((err) => {
    console.error(`[invoke] ${opts.functionName} fire-and-forget crash:`, err);
    if (opts.supabase) {
      opts.supabase.from('activity_logs').insert({
        action: 'ERROR',
        resource: 'BRAIN',
        description: `${opts.functionName} crash${opts.errorContext ? ` (${opts.errorContext})` : ''}: ${(err as Error)?.message || String(err).substring(0, 150)}`,
        status: 'ERROR',
      }).then(() => {}, () => {});
    }
  });
}
