import 'server-only'
import type { ErrorContext } from '@/lib/monitoring'

/**
 * Captura un error en el servidor y lo persiste en system_logs.
 * Solo para Server Components, Route Handlers y Server Actions.
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

  console.error(`[${context.module ?? 'app'}]`, message, context.extra ?? '')

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await supabase.from('system_logs').insert({
      action: 'error_aplicacion',
      client_id: context.client_id ?? null,
      details: {
        module:   context.module ?? 'unknown',
        message,
        stack:    stack?.split('\n').slice(0, 5).join('\n'),
        cycle_id: context.cycle_id,
        ...context.extra,
      },
    })
  } catch {
    console.error('[monitoring] No se pudo persistir el error en system_logs')
  }
}
