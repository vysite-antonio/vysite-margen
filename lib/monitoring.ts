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
