/**
 * monitoring.ts
 * ─────────────────────────────────────────────────────────────
 * Error monitoring ligero para Vysite Margen.
 *
 * Diseño intencional: sin dependencias externas. Los errores se
 * escriben en la tabla `system_logs` de Supabase para que el admin
 * los vea en el panel sin necesidad de un servicio de terceros.
 *
 * Cuando el volumen lo justifique, sustituir captureError() por la
 * llamada equivalente de Sentry (misma firma) y añadir:
 *   npm install @sentry/nextjs
 *   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
 */

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export interface ErrorContext {
  /** Módulo o componente donde ocurrió el error */
  module?: string
  /** ID de cliente si está disponible */
  client_id?: string
  /** ID de ciclo si está disponible */
  cycle_id?: string
  /** Datos adicionales para depuración */
  extra?: Record<string, unknown>
}

// ──────────────────────────────────────────────────────────────
// Server-side: captureError para Server Components y Edge Functions
// ──────────────────────────────────────────────────────────────

/**
 * Captura un error en el servidor y lo persiste en system_logs.
 * Llámalo desde bloques catch en Server Components.
 *
 * @example
 * try { ... } catch (err) { await captureError(err, { module: 'dashboard' }) }
 */
export async function captureError(
  error: unknown,
  context: ErrorContext = {}
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const stack   = error instanceof Error ? error.stack  : undefined

  // Siempre loguear en consola para los logs de servidor/Vercel
  console.error(`[${context.module ?? 'app'}]`, message, context.extra ?? '')

  // Intentar persistir en Supabase (solo en entornos con acceso a servidor)
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('system_logs').insert({
      action: 'error_aplicacion',
      client_id: context.client_id ?? null,
      details: {
        module:    context.module ?? 'unknown',
        message,
        stack:     stack?.split('\n').slice(0, 5).join('\n'),
        cycle_id:  context.cycle_id,
        ...context.extra,
      },
    })
  } catch {
    // Si falla el log, no queremos una cascada de errores
    console.error('[monitoring] No se pudo persistir el error en system_logs')
  }
}

// ──────────────────────────────────────────────────────────────
// Client-side: captureClientError para componentes cliente
// ──────────────────────────────────────────────────────────────

/**
 * Captura un error en el cliente y lo envía a /api/log-error.
 * Llámalo desde catch blocks en Client Components.
 */
export function captureClientError(
  error: unknown,
  context: ErrorContext = {}
): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack   = error instanceof Error ? error.stack  : undefined

  console.error(`[client:${context.module ?? 'app'}]`, message)

  // Fire-and-forget: no bloquea el flujo de la UI
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      module:   context.module ?? 'client',
      message,
      stack:    stack?.split('\n').slice(0, 5).join('\n'),
      extra:    context.extra,
      client_id: context.client_id,
    }),
  }).catch(() => {
    // Silencioso: si la red falla no hacemos nada
  })
}
